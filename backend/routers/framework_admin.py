from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Domain, Subdomain, Question, Criterion

router = APIRouter(prefix="/framework", tags=["framework-admin"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class DomainCreate(BaseModel):
    code:        str
    label:       str
    weight:      float = 1.0
    order_index: Optional[int] = None

class DomainUpdate(BaseModel):
    label:       Optional[str]   = None
    weight:      Optional[float] = None
    order_index: Optional[int]   = None

class SubdomainCreate(BaseModel):
    code:        str
    label:       str
    weight:      float = 1.0
    order_index: Optional[int] = None

class SubdomainUpdate(BaseModel):
    label:       Optional[str]   = None
    weight:      Optional[float] = None
    order_index: Optional[int]   = None

class QuestionCreate(BaseModel):
    text:        str
    guidance:    Optional[str] = None
    order_index: Optional[int] = None
    priority:    str = "P1"  # P0 | P1 | P2

class QuestionUpdate(BaseModel):
    text:        Optional[str] = None
    guidance:    Optional[str] = None
    order_index: Optional[int] = None
    priority:    Optional[str] = None  # P0 | P1 | P2

class CriterionCreate(BaseModel):
    text:                 str
    verification_hint:    Optional[str]   = None
    weight:               float = 1.0
    order_index:          Optional[int]   = None
    effort_default:       str = "moyen"
    impact_default:       str = "moyen"
    recommendation_label: Optional[str]   = None

class CriterionUpdate(BaseModel):
    text:                 Optional[str]   = None
    verification_hint:    Optional[str]   = None
    weight:               Optional[float] = None
    order_index:          Optional[int]   = None
    effort_default:       Optional[str]   = None
    impact_default:       Optional[str]   = None
    recommendation_label: Optional[str]   = None


# ─── Serializers ──────────────────────────────────────────────────────────────

def _ser_criterion(c: Criterion) -> dict:
    return {
        "id":                   c.id,
        "text":                 c.text,
        "verification_hint":    c.verification_hint,
        "weight":               c.weight,
        "order_index":          c.order_index,
        "effort_default":       c.effort_default,
        "impact_default":       c.impact_default,
        "recommendation_label": c.recommendation_label,
    }

def _ser_question(q: Question, with_criteria: bool = True) -> dict:
    d = {
        "id":          q.id,
        "text":        q.text,
        "guidance":    q.guidance,
        "order_index": q.order_index,
        "priority":    getattr(q, "priority", "P1") or "P1",
    }
    if with_criteria:
        d["criteria"] = [_ser_criterion(c) for c in q.criteria]
    return d

def _ser_subdomain(sd: Subdomain, with_questions: bool = True) -> dict:
    d = {
        "id":          sd.id,
        "code":        sd.code,
        "label":       sd.label,
        "weight":      sd.weight,
        "order_index": sd.order_index,
        "domain_id":   sd.domain_id,
    }
    if with_questions:
        d["questions"] = [_ser_question(q) for q in sd.questions]
    return d

def _ser_domain(domain: Domain, with_subdomains: bool = True) -> dict:
    d = {
        "id":          domain.id,
        "code":        domain.code,
        "label":       domain.label,
        "weight":      domain.weight,
        "order_index": domain.order_index,
    }
    if with_subdomains:
        d["subdomains"] = [_ser_subdomain(sd) for sd in domain.subdomains]
    return d


# ─── Domains ──────────────────────────────────────────────────────────────────

@router.get("/admin/domains")
def list_domains(db: Session = Depends(get_db)):
    domains = db.query(Domain).order_by(Domain.order_index).all()
    return [_ser_domain(d, with_subdomains=False) for d in domains]

@router.post("/admin/domains", status_code=201)
def create_domain(body: DomainCreate, db: Session = Depends(get_db)):
    if db.query(Domain).filter_by(code=body.code).first():
        raise HTTPException(409, f"Code '{body.code}' already in use")
    if body.order_index is None:
        body.order_index = db.query(Domain).count()
    d = Domain(**body.model_dump())
    db.add(d); db.commit(); db.refresh(d)
    return _ser_domain(d, with_subdomains=False)

@router.patch("/admin/domains/{domain_id}")
def update_domain(domain_id: str, body: DomainUpdate, db: Session = Depends(get_db)):
    d = db.get(Domain, domain_id)
    if not d: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit(); db.refresh(d)
    return _ser_domain(d, with_subdomains=False)

@router.delete("/admin/domains/{domain_id}")
def delete_domain(domain_id: str, db: Session = Depends(get_db)):
    d = db.get(Domain, domain_id)
    if not d: raise HTTPException(404)
    db.delete(d); db.commit()
    return {"ok": True}


# ─── Subdomains ───────────────────────────────────────────────────────────────

@router.get("/admin/domains/{domain_id}/subdomains")
def list_subdomains(domain_id: str, db: Session = Depends(get_db)):
    sds = db.query(Subdomain).filter_by(domain_id=domain_id)\
            .order_by(Subdomain.order_index).all()
    return [_ser_subdomain(sd, with_questions=False) for sd in sds]

@router.post("/admin/domains/{domain_id}/subdomains", status_code=201)
def create_subdomain(domain_id: str, body: SubdomainCreate, db: Session = Depends(get_db)):
    if not db.get(Domain, domain_id): raise HTTPException(404)
    if db.query(Subdomain).filter_by(code=body.code).first():
        raise HTTPException(409, f"Code '{body.code}' already in use")
    if body.order_index is None:
        body.order_index = db.query(Subdomain).filter_by(domain_id=domain_id).count()
    sd = Subdomain(domain_id=domain_id, **body.model_dump())
    db.add(sd); db.commit(); db.refresh(sd)
    return _ser_subdomain(sd, with_questions=False)

@router.patch("/admin/subdomains/{subdomain_id}")
def update_subdomain(subdomain_id: str, body: SubdomainUpdate, db: Session = Depends(get_db)):
    sd = db.get(Subdomain, subdomain_id)
    if not sd: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(sd, k, v)
    db.commit(); db.refresh(sd)
    return _ser_subdomain(sd, with_questions=False)

@router.delete("/admin/subdomains/{subdomain_id}")
def delete_subdomain(subdomain_id: str, db: Session = Depends(get_db)):
    sd = db.get(Subdomain, subdomain_id)
    if not sd: raise HTTPException(404)
    db.delete(sd); db.commit()
    return {"ok": True}


# ─── Questions ────────────────────────────────────────────────────────────────

@router.get("/admin/subdomains/{subdomain_id}/questions")
def list_questions(subdomain_id: str, db: Session = Depends(get_db)):
    qs = db.query(Question).filter_by(subdomain_id=subdomain_id)\
           .order_by(Question.order_index).all()
    return [_ser_question(q) for q in qs]

@router.post("/admin/subdomains/{subdomain_id}/questions", status_code=201)
def create_question(subdomain_id: str, body: QuestionCreate, db: Session = Depends(get_db)):
    if not db.get(Subdomain, subdomain_id): raise HTTPException(404)
    if body.order_index is None:
        body.order_index = db.query(Question).filter_by(subdomain_id=subdomain_id).count() + 1
    q = Question(subdomain_id=subdomain_id, **body.model_dump())
    db.add(q); db.commit(); db.refresh(q)
    return _ser_question(q)

@router.patch("/admin/questions/{question_id}")
def update_question(question_id: str, body: QuestionUpdate, db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(q, k, v)
    db.commit(); db.refresh(q)
    return _ser_question(q)

@router.delete("/admin/questions/{question_id}")
def delete_question(question_id: str, db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q: raise HTTPException(404)
    db.delete(q); db.commit()
    return {"ok": True}


# ─── Criteria ─────────────────────────────────────────────────────────────────

@router.post("/admin/questions/{question_id}/criteria", status_code=201)
def create_criterion(question_id: str, body: CriterionCreate, db: Session = Depends(get_db)):
    if not db.get(Question, question_id): raise HTTPException(404)
    if body.order_index is None:
        body.order_index = db.query(Criterion).filter_by(question_id=question_id).count() + 1
    c = Criterion(question_id=question_id, **body.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return _ser_criterion(c)

@router.patch("/admin/criteria/{criterion_id}")
def update_criterion(criterion_id: str, body: CriterionUpdate, db: Session = Depends(get_db)):
    c = db.get(Criterion, criterion_id)
    if not c: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return _ser_criterion(c)

@router.delete("/admin/criteria/{criterion_id}")
def delete_criterion(criterion_id: str, db: Session = Depends(get_db)):
    c = db.get(Criterion, criterion_id)
    if not c: raise HTTPException(404)
    db.delete(c); db.commit()
    return {"ok": True}


# ─── Vue complète (lecture seule, pour l'UI) ──────────────────────────────────

@router.get("/admin/full")
def get_full_framework(db: Session = Depends(get_db)):
    """Arbre complet domaines > sous-domaines > questions > critères."""
    domains = db.query(Domain).order_by(Domain.order_index).all()
    return [_ser_domain(d) for d in domains]
