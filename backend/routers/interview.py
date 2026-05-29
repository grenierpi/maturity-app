from __future__ import annotations
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, settings
from models import (
    Campaign, CriterionResponse, Criterion,
    Question, Subdomain, Domain, Proof
)
from scoring import trigger_subdomain_score_update

router = APIRouter(prefix="/campaigns", tags=["interview"])

ALLOWED_MIME_TYPES = {
    "application/pdf", "image/png", "image/jpeg",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ResponseUpdate(BaseModel):
    score:   Optional[int]  = None
    comment: Optional[str]  = None
    flagged: Optional[bool] = None


# ─── Navigation ───────────────────────────────────────────────────────────────

def _get_ordered_question_ids(campaign_id: str, db: Session) -> list[str]:
    """Liste ordonnée des question IDs dans le périmètre de la campagne."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        return []

    questions = (
        db.query(Question)
        .join(Subdomain, Question.subdomain_id == Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(Domain.code.in_(campaign.domain_scope))
        .order_by(Domain.order_index, Subdomain.order_index, Question.order_index)
        .all()
    )
    return [q.id for q in questions]


def _get_navigation(campaign_id: str, question_id: str, db: Session) -> dict:
    ids = _get_ordered_question_ids(campaign_id, db)
    idx = ids.index(question_id) if question_id in ids else -1
    return {
        "current_index": idx,
        "total":         len(ids),
        "prev_id":       ids[idx - 1] if idx > 0 else None,
        "next_id":       ids[idx + 1] if idx < len(ids) - 1 else None,
        "first_id":      ids[0] if ids else None,
        "last_id":       ids[-1] if ids else None,
    }


# ─── Question list ────────────────────────────────────────────────────────────

@router.get("/{campaign_id}/interview/questions")
def list_questions(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    questions = (
        db.query(Question)
        .join(Subdomain, Question.subdomain_id == Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(Domain.code.in_(campaign.domain_scope))
        .order_by(Domain.order_index, Subdomain.order_index, Question.order_index)
        .all()
    )

    result = []
    for q in questions:
        responses = (
            db.query(CriterionResponse)
            .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
            .filter(
                CriterionResponse.campaign_id == campaign_id,
                Criterion.question_id == q.id,
            )
            .all()
        )
        total    = len(responses)
        answered = sum(1 for r in responses if r.score is not None)
        flagged  = any(r.flagged for r in responses)

        result.append({
            "id":               q.id,
            "text":             q.text,
            "order_index":      q.order_index,
            "subdomain_code":   q.subdomain.code,
            "subdomain_label":  q.subdomain.label,
            "domain_code":      q.subdomain.domain.code,
            "domain_label":     q.subdomain.domain.label,
            "priority":         getattr(q, "priority", "P1") or "P1",
            "answered":         answered,
            "total":            total,
            "pct":              round(answered / total * 100) if total else 0,
            "flagged":          flagged,
        })

    return result


# ─── Question detail ──────────────────────────────────────────────────────────

@router.get("/{campaign_id}/interview/questions/{question_id}")
def get_question_detail(
    campaign_id: str, question_id: str, db: Session = Depends(get_db)
):
    question = db.get(Question, question_id)
    if not question:
        raise HTTPException(404)

    responses = (
        db.query(CriterionResponse)
        .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
        .filter(
            CriterionResponse.campaign_id == campaign_id,
            Criterion.question_id == question_id,
        )
        .order_by(Criterion.order_index)
        .all()
    )

    return {
        "question": {
            "id":       question.id,
            "text":     question.text,
            "guidance": question.guidance,
            "subdomain": {
                "code":  question.subdomain.code,
                "label": question.subdomain.label,
            },
            "domain": {
                "code":  question.subdomain.domain.code,
                "label": question.subdomain.domain.label,
            },
        },
        "criteria_responses": [
            {
                "response_id": r.id,
                "criterion": {
                    "id":               r.criterion.id,
                    "text":             r.criterion.text,
                    "verification_hint":r.criterion.verification_hint,
                    "weight":           r.criterion.weight,
                    "order_index":      r.criterion.order_index,
                },
                "score":   r.score,
                "comment": r.comment,
                "flagged": r.flagged,
                "proofs": [
                    {"id": p.id, "filename": p.filename, "mime_type": p.mime_type}
                    for p in r.proofs
                ],
            }
            for r in responses
        ],
        "navigation": _get_navigation(campaign_id, question_id, db),
    }


# ─── Autosave réponse ─────────────────────────────────────────────────────────

@router.patch("/{campaign_id}/responses/{response_id}")
def update_response(
    campaign_id: str,
    response_id: str,
    body: ResponseUpdate,
    db: Session = Depends(get_db),
):
    r = db.get(CriterionResponse, response_id)
    if not r or r.campaign_id != campaign_id:
        raise HTTPException(404)

    if body.score is not None:
        if body.score not in range(0, 5):
            raise HTTPException(422, "Score must be between 0 and 4")
        r.score = body.score
    if body.comment is not None:
        r.comment = body.comment
    if body.flagged is not None:
        r.flagged = body.flagged

    r.updated_at = datetime.utcnow()
    db.commit()

    # Recalcul scoring du sous-domaine concerné
    subdomain_id = r.criterion.question.subdomain_id
    trigger_subdomain_score_update(campaign_id, subdomain_id, db)

    return {"ok": True, "updated_at": r.updated_at}


# ─── Pièces jointes ───────────────────────────────────────────────────────────

@router.post("/{campaign_id}/responses/{response_id}/proofs", status_code=201)
async def upload_proof(
    campaign_id: str,
    response_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    r = db.get(CriterionResponse, response_id)
    if not r or r.campaign_id != campaign_id:
        raise HTTPException(404)

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(422, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(422, "Fichier trop volumineux (max 10 Mo)")

    upload_dir = Path(settings.upload_dir) / campaign_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    from uuid import uuid4
    safe_name = f"{uuid4()}_{file.filename}"
    dest      = upload_dir / safe_name
    dest.write_bytes(contents)

    proof = Proof(
        response_id  = response_id,
        filename     = file.filename,
        storage_path = str(dest),
        mime_type    = file.content_type,
    )
    db.add(proof)
    db.commit()
    db.refresh(proof)

    return {"id": proof.id, "filename": proof.filename, "mime_type": proof.mime_type}


@router.delete("/{campaign_id}/responses/{response_id}/proofs/{proof_id}")
def delete_proof(
    campaign_id: str,
    response_id: str,
    proof_id: str,
    db: Session = Depends(get_db),
):
    r = db.get(CriterionResponse, response_id)
    if not r or r.campaign_id != campaign_id:
        raise HTTPException(404)

    proof = db.get(Proof, proof_id)
    if not proof or proof.response_id != response_id:
        raise HTTPException(404)

    # Supprimer le fichier physique
    try:
        Path(proof.storage_path).unlink(missing_ok=True)
    except Exception:
        pass

    db.delete(proof)
    db.commit()
    return {"ok": True}
