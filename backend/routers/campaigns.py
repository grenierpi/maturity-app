from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import (
    Supplier, Campaign, CriterionResponse,
    SubdomainScore, Criterion, Question, Subdomain, Domain
)
from scoring import compute_all_scores

router = APIRouter(tags=["campaigns"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name:    str
    sector:  Optional[str] = None
    country: str = "FR"


class CampaignCreate(BaseModel):
    supplier_id:     str
    title:           str
    consultant_name: Optional[str] = None
    domain_scope:    list[str]


class CampaignUpdate(BaseModel):
    title:           Optional[str]       = None
    consultant_name: Optional[str]       = None
    status:          Optional[str]       = None
    synthesis_notes: Optional[str]       = None


# ─── Suppliers ────────────────────────────────────────────────────────────────

@router.post("/suppliers", status_code=201)
def create_supplier(body: SupplierCreate, db: Session = Depends(get_db)):
    s = Supplier(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/suppliers")
def list_suppliers(q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Supplier)
    if q:
        query = query.filter(Supplier.name.ilike(f"%{q}%"))
    return query.order_by(Supplier.created_at.desc()).all()


@router.get("/suppliers/{supplier_id}")
def get_supplier(supplier_id: str, db: Session = Depends(get_db)):
    s = db.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(404)
    return s


# ─── Campaigns ────────────────────────────────────────────────────────────────

def _campaign_progress(campaign: Campaign) -> dict:
    total    = len(campaign.criterion_responses)
    answered = sum(1 for r in campaign.criterion_responses if r.score is not None)
    flagged  = sum(1 for r in campaign.criterion_responses if r.flagged)
    return {
        "answered": answered,
        "total":    total,
        "flagged":  flagged,
        "pct":      round(answered / total * 100) if total else 0,
    }


def _serialize_campaign(c: Campaign) -> dict:
    return {
        "id":               c.id,
        "title":            c.title,
        "status":           c.status,
        "consultant_name":  c.consultant_name,
        "domain_scope":     c.domain_scope,
        "created_at":       c.created_at,
        "updated_at":       c.updated_at,
        "supplier": {
            "id":     c.supplier.id,
            "name":   c.supplier.name,
            "sector": c.supplier.sector,
        },
        "progress": _campaign_progress(c),
    }


@router.post("/campaigns", status_code=201)
def create_campaign(body: CampaignCreate, db: Session = Depends(get_db)):
    supplier = db.get(Supplier, body.supplier_id)
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    # Valider que les domain_codes existent
    domains = db.query(Domain).filter(Domain.code.in_(body.domain_scope)).all()
    if len(domains) != len(body.domain_scope):
        raise HTTPException(422, "One or more domain codes not found in framework")

    c = Campaign(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _serialize_campaign(c)


@router.get("/campaigns")
def list_campaigns(
    status:      Optional[str] = None,
    supplier_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Campaign)
    if status:
        query = query.filter(Campaign.status == status)
    if supplier_id:
        query = query.filter(Campaign.supplier_id == supplier_id)
    campaigns = query.order_by(Campaign.created_at.desc()).all()
    return [_serialize_campaign(c) for c in campaigns]


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404)
    return _serialize_campaign(c)


@router.patch("/campaigns/{campaign_id}")
def update_campaign(
    campaign_id: str, body: CampaignUpdate, db: Session = Depends(get_db)
):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    c.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_campaign(c)


@router.delete("/campaigns/{campaign_id}")
def archive_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404)
    c.status = "ARCHIVED"
    db.commit()
    return {"ok": True}


# ─── Initialize ───────────────────────────────────────────────────────────────

@router.post("/campaigns/{campaign_id}/initialize")
def initialize_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404)
    if c.status != "DRAFT":
        raise HTTPException(400, "Campaign already initialized")

    criteria = (
        db.query(Criterion)
        .join(Question, Criterion.question_id == Question.id)
        .join(Subdomain, Question.subdomain_id == Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(Domain.code.in_(c.domain_scope))
        .all()
    )

    existing_ids = {r.criterion_id for r in c.criterion_responses}
    created = 0
    for criterion in criteria:
        if criterion.id not in existing_ids:
            db.add(CriterionResponse(
                campaign_id  = campaign_id,
                criterion_id = criterion.id,
            ))
            created += 1

    c.status = "IN_PROGRESS"
    db.commit()
    return {"initialized": created, "total_criteria": len(criteria)}


# ─── Progress ─────────────────────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}/progress")
def get_progress(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404)

    global_progress = _campaign_progress(c)

    # Par domaine
    by_domain = []
    for domain_code in c.domain_scope:
        domain = db.query(Domain).filter_by(code=domain_code).first()
        if not domain:
            continue

        domain_responses = (
            db.query(CriterionResponse)
            .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
            .join(Question, Criterion.question_id == Question.id)
            .join(Subdomain, Question.subdomain_id == Subdomain.id)
            .filter(
                CriterionResponse.campaign_id == campaign_id,
                Subdomain.domain_id == domain.id,
            )
            .all()
        )
        total    = len(domain_responses)
        answered = sum(1 for r in domain_responses if r.score is not None)
        flagged  = sum(1 for r in domain_responses if r.flagged)
        by_domain.append({
            "domain_code":  domain_code,
            "domain_label": domain.label,
            "answered":     answered,
            "total":        total,
            "flagged":      flagged,
            "pct":          round(answered / total * 100) if total else 0,
        })

    # Compter les questions P0/P1 non entièrement répondues
    mandatory_unanswered = (
        db.query(CriterionResponse)
        .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
        .join(Question, Criterion.question_id == Question.id)
        .join(Subdomain, Question.subdomain_id == Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(
            CriterionResponse.campaign_id == campaign_id,
            CriterionResponse.score.is_(None),
            Question.priority.in_(["P0", "P1"]),
            Domain.code.in_(c.domain_scope),
        )
        .count()
    )

    return {"global": global_progress, "by_domain": by_domain, "mandatory_unanswered": mandatory_unanswered}


# ─── Complete ─────────────────────────────────────────────────────────────────

@router.post("/campaigns/{campaign_id}/complete")
def complete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    c = db.get(Campaign, campaign_id)
    if not c:
        raise HTTPException(404)

    # Critères non répondus sur les questions P0 et P1 uniquement
    mandatory_unanswered = (
        db.query(CriterionResponse)
        .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
        .join(Question, Criterion.question_id == Question.id)
        .join(Subdomain, Question.subdomain_id == Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(
            CriterionResponse.campaign_id == campaign_id,
            CriterionResponse.score.is_(None),
            Question.priority.in_(["P0", "P1"]),
            Domain.code.in_(c.domain_scope),
        )
        .count()
    )

    if mandatory_unanswered > 0:
        return {
            "completable": False,
            "unanswered":  mandatory_unanswered,
            "message":     f"{mandatory_unanswered} critères P0/P1 non renseignés — les questions P2 peuvent être ignorées",
        }

    compute_all_scores(campaign_id, db)
    c.status = "COMPLETED"
    db.commit()
    return {"completable": True, "status": "COMPLETED"}
