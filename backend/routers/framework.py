from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, settings
from models import Domain, Subdomain, Question, Criterion
from scripts.seed_jip_framework import seed as do_seed

router = APIRouter(prefix="/framework", tags=["framework"])


@router.get("")
def get_framework(db: Session = Depends(get_db)):
    domains = db.query(Domain).order_by(Domain.order_index).all()
    return [
        {
            "id":    d.id,
            "code":  d.code,
            "label": d.label,
            "weight": d.weight,
            "subdomains": [
                {
                    "id":    sd.id,
                    "code":  sd.code,
                    "label": sd.label,
                    "weight": sd.weight,
                    "questions_count": len(sd.questions),
                }
                for sd in d.subdomains
            ],
        }
        for d in domains
    ]


@router.get("/domains")
def list_domains(db: Session = Depends(get_db)):
    return db.query(Domain).order_by(Domain.order_index).all()


@router.get("/questions/{question_id}")
def get_question(question_id: str, db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q:
        raise HTTPException(404)
    return {
        "id":       q.id,
        "text":     q.text,
        "guidance": q.guidance,
        "subdomain": {
            "id":    q.subdomain.id,
            "code":  q.subdomain.code,
            "label": q.subdomain.label,
        },
        "domain": {
            "code":  q.subdomain.domain.code,
            "label": q.subdomain.domain.label,
        },
        "criteria": [
            {
                "id":                   c.id,
                "text":                 c.text,
                "verification_hint":    c.verification_hint,
                "weight":               c.weight,
                "order_index":          c.order_index,
                "effort_default":       c.effort_default,
                "impact_default":       c.impact_default,
                "recommendation_label": c.recommendation_label,
            }
            for c in q.criteria
        ],
    }


@router.post("/seed")
def seed_framework(filepath: str = "framework.xlsx"):
    """Recharge le framework depuis un fichier Excel (dev only)."""
    if settings.env != "development":
        raise HTTPException(403, "Seed endpoint is only available in development mode")
    try:
        do_seed(filepath)
        return {"ok": True, "message": f"Framework reloaded from {filepath}"}
    except Exception as e:
        raise HTTPException(500, str(e))