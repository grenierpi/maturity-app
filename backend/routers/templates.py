from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    ProjectTemplate, ProjectTemplateImpact,
    TransformationItem, Campaign,
    Subdomain, Domain, SubdomainScore
)

router = APIRouter(tags=["templates"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ImpactIn(BaseModel):
    subdomain_id:  str
    maturity_target: float   # 0.0–4.0

class TemplateCreate(BaseModel):
    label:            str
    description:      Optional[str]   = None
    effort_default:   str = "moyen"
    impact_default:   str = "moyen"
    maturity_minimum: Optional[float] = None  # score as-is min requis (0-4)
    impacts:          list[ImpactIn] = []

class TemplateUpdate(BaseModel):
    label:            Optional[str]   = None
    description:      Optional[str]   = None
    effort_default:   Optional[str]   = None
    impact_default:   Optional[str]   = None
    active:           Optional[bool]  = None
    maturity_minimum: Optional[float] = None
    impacts:          Optional[list[ImpactIn]] = None  # remplace tous les impacts si fourni


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_template(t: ProjectTemplate) -> dict:
    return {
        "id":             t.id,
        "label":          t.label,
        "description":    t.description,
        "effort_default": t.effort_default,
        "impact_default": t.impact_default,
        "source":           t.source,
        "active":           t.active,
        "maturity_minimum": t.maturity_minimum,
        "created_at":       t.created_at,
        "updated_at":       t.updated_at,
        "impacts": [
            {
                "id":            i.id,
                "subdomain_id":  i.subdomain_id,
                "subdomain_code": i.subdomain.code,
                "subdomain_label": i.subdomain.label,
                "domain_code":   i.subdomain.domain.code,
                "domain_label":  i.subdomain.domain.label,
                "maturity_target": i.maturity_target,
            }
            for i in sorted(t.impacts, key=lambda x: x.subdomain.domain.order_index)
        ],
    }


# ─── CRUD catalogue ───────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    q = db.query(ProjectTemplate)
    if active_only:
        q = q.filter_by(active=True)
    return [_serialize_template(t) for t in q.order_by(ProjectTemplate.created_at.desc()).all()]


@router.get("/templates/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db)):
    t = db.get(ProjectTemplate, template_id)
    if not t:
        raise HTTPException(404)
    return _serialize_template(t)


@router.post("/templates", status_code=201)
def create_template(body: TemplateCreate, db: Session = Depends(get_db)):
    t = ProjectTemplate(
        label          = body.label,
        description    = body.description,
        effort_default = body.effort_default,
        impact_default = body.impact_default,
        source         = "manual",
    )
    db.add(t)
    db.flush()
    _upsert_impacts(t.id, body.impacts, db)
    db.commit()
    db.refresh(t)
    return _serialize_template(t)


@router.patch("/templates/{template_id}")
def update_template(
    template_id: str, body: TemplateUpdate, db: Session = Depends(get_db)
):
    t = db.get(ProjectTemplate, template_id)
    if not t:
        raise HTTPException(404)

    for field, value in body.model_dump(exclude_none=True, exclude={"impacts"}).items():
        setattr(t, field, value)
    t.updated_at = datetime.utcnow()

    if body.impacts is not None:
        # Remplacer tous les impacts
        db.query(ProjectTemplateImpact).filter_by(template_id=template_id).delete()
        db.flush()
        _upsert_impacts(template_id, body.impacts, db)

    db.commit()
    db.refresh(t)
    return _serialize_template(t)


@router.delete("/templates/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)):
    t = db.get(ProjectTemplate, template_id)
    if not t:
        raise HTTPException(404)
    t.active = False   # soft delete
    db.commit()
    return {"ok": True}


def _upsert_impacts(template_id: str, impacts: list[ImpactIn], db: Session):
    for imp in impacts:
        gain = max(0.0, min(4.0, imp.maturity_target))  # cap 0–4
        db.add(ProjectTemplateImpact(
            template_id   = template_id,
            subdomain_id  = imp.subdomain_id,
            maturity_target = gain,
        ))


# ─── To-be calculator ────────────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}/tobe")
def get_tobe(campaign_id: str, db: Session = Depends(get_db)):
    """
    Calcule le to-be par sous-domaine et par domaine
    en additionnant les gains des chantiers retenus (status != excluded)
    à l'as-is existant. Cappé à 4.0.
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    # Chantiers retenus avec un template associé
    items = (
        db.query(TransformationItem)
        .filter(
            TransformationItem.campaign_id == campaign_id,
            TransformationItem.status != "excluded",
            TransformationItem.template_id.isnot(None),
        )
        .all()
    )

    # Agréger les gains par subdomain_id
    gains_by_sd: dict[str, float] = {}
    for item in items:
        for impact in item.template.impacts:
            sid = impact.subdomain_id
            gains_by_sd[sid] = max(gains_by_sd.get(sid, 0.0), impact.maturity_target)

    # Récupérer les scores as-is
    subdomain_scores = (
        db.query(SubdomainScore)
        .filter_by(campaign_id=campaign_id)
        .all()
    )
    as_is_by_sd = {ss.subdomain_id: ss.score_computed or 0.0 for ss in subdomain_scores}

    # Construire la réponse par domaine
    domains = (
        db.query(Domain)
        .filter(Domain.code.in_(campaign.domain_scope))
        .order_by(Domain.order_index)
        .all()
    )

    result = []
    for domain in domains:
        sds = []
        domain_as_is_scores, domain_tobe_scores = [], []

        for sd in domain.subdomains:
            as_is = as_is_by_sd.get(sd.id)
            gain  = gains_by_sd.get(sd.id, 0.0)   # target absolu, 0 = pas de chantier
            tobe  = min(4.0, max(as_is or 0.0, gain)) if gain > 0 and as_is is not None else as_is

            if as_is is not None:
                domain_as_is_scores.append(as_is)
            if tobe is not None:
                domain_tobe_scores.append(tobe)

            sds.append({
                "subdomain_id":    sd.id,
                "subdomain_code":  sd.code,
                "subdomain_label": sd.label,
                "as_is":           round(as_is, 2) if as_is is not None else None,
                "gain":            round(gain, 2),
                "tobe":            round(tobe, 2) if tobe is not None else None,
            })

        domain_as_is = (sum(domain_as_is_scores) / len(domain_as_is_scores)
                        if domain_as_is_scores else None)
        domain_tobe  = (sum(domain_tobe_scores) / len(domain_tobe_scores)
                        if domain_tobe_scores else None)

        result.append({
            "domain_code":  domain.code,
            "domain_label": domain.label,
            "as_is":        round(domain_as_is, 2) if domain_as_is is not None else None,
            "tobe":         round(domain_tobe, 2)  if domain_tobe  is not None else None,
            "subdomains":   sds,
        })

    return {
        "campaign_id": campaign_id,
        "domains":     result,
        "items_count": len(items),
    }
