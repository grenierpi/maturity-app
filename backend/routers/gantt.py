from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Campaign, TransformationItem, Domain

router = APIRouter(prefix="/campaigns", tags=["gantt"])

PHASES = {
    "quick_win": {"label": "Quick wins",  "color": "#1D9E75", "order": 0},
    "court":     {"label": "Court terme",  "color": "#7F77DD", "order": 1},
    "moyen":     {"label": "Moyen terme", "color": "#BA7517", "order": 2},
    "long":      {"label": "Long terme",   "color": "#888780", "order": 3},
}

DOMAIN_COLORS = {
    "ORG":  "#7F77DD", "PLAN": "#1D9E75",
    "SIM":  "#BA7517", "IQ":   "#E24B4A", "ME":  "#378ADD",
}


class ScheduleUpdate(BaseModel):
    start_month:     Optional[str] = None   # "YYYY-MM"
    duration_months: Optional[int] = None
    phase:           Optional[str] = None
    status:          Optional[str] = None


def _serialize_item(item: TransformationItem) -> dict:
    domain_code = (item.domain_codes or [""])[0]
    return {
        "id":              item.id,
        "num":             item.priority_rank or 0,
        "label":           item.label_custom or item.recommendation_label,
        "domain_codes":    item.domain_codes,
        "domain_code":     domain_code,
        "domain_color":    DOMAIN_COLORS.get(domain_code, "#888780"),
        "effort":          item.effort,
        "impact":          item.impact,
        "start_month":     item.start_month,
        "duration_months": item.duration_months or 3,
        "phase":           item.phase or "moyen",
        "phase_label":     PHASES.get(item.phase or "moyen", PHASES["moyen"])["label"],
        "phase_color":     PHASES.get(item.phase or "moyen", PHASES["moyen"])["color"],
        "status":          item.status,
    }


@router.get("/{campaign_id}/gantt")
def get_gantt(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    items = (
        db.query(TransformationItem)
        .filter_by(campaign_id=campaign_id)
        .filter(TransformationItem.status != "excluded")
        .order_by(TransformationItem.priority_rank)
        .all()
    )

    serialized = [_serialize_item(i) for i in items]

    # Grouper par phase
    by_phase = {p: [] for p in PHASES}
    for item in serialized:
        phase = item["phase"] if item["phase"] in PHASES else "moyen"
        by_phase[phase].append(item)

    return {
        "campaign_id": campaign_id,
        "items":       serialized,
        "by_phase":    [
            {
                "phase":  phase,
                "label":  PHASES[phase]["label"],
                "color":  PHASES[phase]["color"],
                "items":  by_phase[phase],
            }
            for phase in sorted(PHASES, key=lambda p: PHASES[p]["order"])
        ],
        "phases": PHASES,
    }


@router.patch("/{campaign_id}/gantt/{item_id}")
def update_schedule(
    campaign_id: str, item_id: str,
    body: ScheduleUpdate, db: Session = Depends(get_db)
):
    item = db.get(TransformationItem, item_id)
    if not item or item.campaign_id != campaign_id:
        raise HTTPException(404)

    if body.start_month is not None:
        item.start_month = body.start_month
    if body.duration_months is not None:
        item.duration_months = max(1, min(24, body.duration_months))
    if body.phase is not None and body.phase in PHASES:
        item.phase = body.phase
    if body.status is not None:
        item.status = body.status

    db.commit()
    db.refresh(item)
    return _serialize_item(item)
