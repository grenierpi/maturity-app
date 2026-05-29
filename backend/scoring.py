from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Session
from models import (
    CriterionResponse, Criterion, Question,
    Subdomain, Domain, SubdomainScore, Campaign
)


def compute_subdomain_score(
    campaign_id: str, subdomain_id: str, db: Session
) -> SubdomainScore | None:
    """
    Calcule et persiste le score d'un sous-domaine.
    Appelé après chaque sauvegarde de réponse.
    """
    responses = (
        db.query(CriterionResponse)
        .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
        .join(Question, Criterion.question_id == Question.id)
        .filter(
            CriterionResponse.campaign_id == campaign_id,
            Question.subdomain_id == subdomain_id,
        )
        .all()
    )

    if not responses:
        return None

    # Grouper par question
    by_question: dict[str, list] = {}
    for r in responses:
        q_id = r.criterion.question_id
        by_question.setdefault(q_id, []).append(r)

    question_scores = []
    for q_responses in by_question.values():
        scored = [r for r in q_responses if r.score is not None]
        if not scored:
            continue
        total_weight = sum(r.criterion.weight for r in scored)
        weighted_sum = sum(r.score * r.criterion.weight for r in scored)
        q_score      = weighted_sum / total_weight if total_weight else 0.0
        question_scores.append(q_score)

    score_computed   = sum(question_scores) / len(question_scores) if question_scores else None
    questions_scored = len(question_scores)
    questions_total  = len(by_question)

    existing = (
        db.query(SubdomainScore)
        .filter_by(campaign_id=campaign_id, subdomain_id=subdomain_id)
        .first()
    )
    if existing:
        existing.score_computed   = score_computed
        existing.questions_scored = questions_scored
        existing.questions_total  = questions_total
        existing.computed_at      = datetime.utcnow()
        record = existing
    else:
        record = SubdomainScore(
            campaign_id      = campaign_id,
            subdomain_id     = subdomain_id,
            score_computed   = score_computed,
            questions_total  = questions_total,
            questions_scored = questions_scored,
        )
        db.add(record)

    db.commit()
    return record


def compute_domain_score(
    campaign_id: str, domain_id: str, db: Session
) -> float | None:
    """Score domaine calculé à la volée (non persisté)."""
    subdomain_scores = (
        db.query(SubdomainScore)
        .join(Subdomain, SubdomainScore.subdomain_id == Subdomain.id)
        .filter(
            SubdomainScore.campaign_id == campaign_id,
            Subdomain.domain_id == domain_id,
            SubdomainScore.score_computed.isnot(None),
        )
        .all()
    )
    if not subdomain_scores:
        return None
    total_weight = sum(ss.subdomain.weight for ss in subdomain_scores)
    weighted_sum = sum(ss.score_computed * ss.subdomain.weight for ss in subdomain_scores)
    return weighted_sum / total_weight if total_weight else None


def compute_all_scores(campaign_id: str, db: Session) -> list[dict]:
    """Recalcule tous les sous-domaines de la campagne."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        return []

    subdomain_ids = (
        db.query(Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(Domain.code.in_(campaign.domain_scope))
        .all()
    )

    results = []
    for (sd_id,) in subdomain_ids:
        score = compute_subdomain_score(campaign_id, sd_id, db)
        if score:
            gap = score.score_target - (score.score_computed or 0)
            results.append({
                "subdomain_id":    sd_id,
                "score_computed":  round(score.score_computed, 2) if score.score_computed else None,
                "score_target":    score.score_target,
                "gap":             round(gap, 2),
            })
    return results


def trigger_subdomain_score_update(
    campaign_id: str, subdomain_id: str, db: Session
):
    """Point d'entrée appelé par le module Interview après chaque PATCH."""
    compute_subdomain_score(campaign_id, subdomain_id, db)


def score_to_bucket(score: float | None) -> str:
    if score is None: return "none"
    if score < 1.0:   return "critical"
    if score < 2.0:   return "weak"
    if score < 3.0:   return "moderate"
    return "good"
