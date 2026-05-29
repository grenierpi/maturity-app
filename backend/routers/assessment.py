from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Campaign, CriterionResponse, Criterion, Question,
    Subdomain, Domain, SubdomainScore,
    ProjectTemplate, ProjectTemplateImpact
)

router = APIRouter(prefix="/campaigns", tags=["assessment"])


# ─── Weak points ──────────────────────────────────────────────────────────────

@router.get("/{campaign_id}/weak-points")
def get_weak_points(campaign_id: str, db: Session = Depends(get_db)):
    """
    Pour chaque sous-domaine : les 2 critères avec le score le plus bas (≤ 2)
    + tous les critères flaggés.
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    domains = (
        db.query(Domain)
        .filter(Domain.code.in_(campaign.domain_scope))
        .order_by(Domain.order_index)
        .all()
    )

    result = []
    for domain in domains:
        for sd in domain.subdomains:
            # Scores de ce sous-domaine
            ss = db.query(SubdomainScore).filter_by(
                campaign_id=campaign_id, subdomain_id=sd.id
            ).first()

            # Réponses scorées de ce sous-domaine
            responses = (
                db.query(CriterionResponse)
                .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
                .join(Question, Criterion.question_id == Question.id)
                .filter(
                    CriterionResponse.campaign_id == campaign_id,
                    Question.subdomain_id == sd.id,
                    CriterionResponse.score.isnot(None),
                )
                .all()
            )

            if not responses:
                continue

            # 2 critères les plus faibles avec score ≤ 2
            scored_low = sorted(
                [r for r in responses if r.score <= 2],
                key=lambda r: (r.score, r.criterion.order_index)
            )[:2]

            # Critères flaggés (pas déjà dans scored_low)
            low_ids = {r.id for r in scored_low}
            flagged = [r for r in responses if r.flagged and r.id not in low_ids]

            weak_items = []
            for r in scored_low + flagged:
                weak_items.append({
                    "response_id":      r.id,
                    "criterion_text":   r.criterion.text,
                    "score":            r.score,
                    "comment":          r.comment,
                    "flagged":          r.flagged,
                    "question_text":    r.criterion.question.text,
                    "priority":         getattr(r.criterion.question, "priority", "P1"),
                })

            result.append({
                "subdomain_id":    sd.id,
                "subdomain_code":  sd.code,
                "subdomain_label": sd.label,
                "domain_code":     domain.code,
                "domain_label":    domain.label,
                "score":           round(ss.score_computed, 2) if ss and ss.score_computed else None,
                "weak_points":     weak_items,
            })

    return result


# ─── Templates by subdomain ───────────────────────────────────────────────────

@router.get("/{campaign_id}/templates-by-subdomain")
def get_templates_by_subdomain(campaign_id: str, db: Session = Depends(get_db)):
    """
    Pour chaque sous-domaine : templates recommandés triés par compatibilité.
    compatible = as-is >= maturity_minimum (ou pas de minimum défini)
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    # Scores as-is par sous-domaine
    ss_list = db.query(SubdomainScore).filter_by(campaign_id=campaign_id).all()
    as_is_map = {ss.subdomain_id: ss.score_computed or 0.0 for ss in ss_list}

    # Tous les templates actifs avec leurs impacts
    templates = db.query(ProjectTemplate).filter_by(active=True).all()

    # Chantiers déjà dans le plan
    from models import TransformationItem
    existing_template_ids = {
        item.template_id
        for item in db.query(TransformationItem)
            .filter_by(campaign_id=campaign_id)
            .filter(TransformationItem.template_id.isnot(None))
            .all()
    }

    # Grouper par subdomain_id
    by_subdomain: dict[str, list] = {}
    for t in templates:
        for impact in t.impacts:
            sd_id = impact.subdomain_id
            if sd_id not in by_subdomain:
                by_subdomain[sd_id] = []

            as_is = as_is_map.get(sd_id, 0.0)
            min_req = t.maturity_minimum
            compatible = (min_req is None) or (as_is >= min_req)

            by_subdomain[sd_id].append({
                "template_id":      t.id,
                "label":            t.label,
                "description":      t.description,
                "effort_default":   t.effort_default,
                "impact_default":   t.impact_default,
                "maturity_minimum": min_req,
                "maturity_target":  impact.maturity_target,
                "compatible":       compatible,
                "as_is":            round(as_is, 2),
                "already_added":    t.id in existing_template_ids,
                "all_impacts": [
                    {
                        "subdomain_id":    i.subdomain_id,
                        "subdomain_code":  i.subdomain.code,
                        "maturity_target": i.maturity_target,
                    }
                    for i in t.impacts
                ],
            })

    # Trier chaque liste : compatibles d'abord, puis par label
    for sd_id in by_subdomain:
        by_subdomain[sd_id].sort(key=lambda x: (not x["compatible"], x["label"]))

    return by_subdomain


# ─── Subdomain targets ────────────────────────────────────────────────────────

class SubdomainTargetUpdate(BaseModel):
    targets: dict[str, float]  # {subdomain_id: target_score}


@router.patch("/{campaign_id}/subdomain-targets")
def update_subdomain_targets(
    campaign_id: str,
    body: SubdomainTargetUpdate,
    db: Session = Depends(get_db)
):
    """Met à jour les cibles de maturité CDP par sous-domaine."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    updated = []
    for subdomain_id, target in body.targets.items():
        target_clamped = max(0.0, min(4.0, float(target)))
        ss = db.query(SubdomainScore).filter_by(
            campaign_id=campaign_id, subdomain_id=subdomain_id
        ).first()
        if ss:
            ss.score_target = target_clamped
            updated.append(subdomain_id)
        else:
            # Créer si pas encore de score (sous-domaine pas encore évalué)
            db.add(SubdomainScore(
                campaign_id  = campaign_id,
                subdomain_id = subdomain_id,
                score_target = target_clamped,
            ))
            updated.append(subdomain_id)

    db.commit()
    return {"updated": len(updated), "subdomain_ids": updated}
