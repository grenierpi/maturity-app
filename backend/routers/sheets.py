from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json, re

from database import get_db, settings
from models import ProjectTemplate, ProjectTemplateSheet, TransformationItem, Campaign

router = APIRouter(tags=["sheets"])


class SheetUpdate(BaseModel):
    objectives:     Optional[str]       = None
    key_actions:    Optional[list[str]] = None
    stakeholders:   Optional[list[str]] = None
    prerequisites:  Optional[str]       = None
    deliverables:   Optional[list[str]] = None
    success_kpis:   Optional[list[str]] = None
    duration_hint:  Optional[str]       = None


def _serialize_sheet(sheet: ProjectTemplateSheet) -> dict:
    return {
        "id":             sheet.id,
        "template_id":    sheet.template_id,
        "objectives":     sheet.objectives or "",
        "key_actions":    sheet.key_actions or [],
        "stakeholders":   sheet.stakeholders or [],
        "prerequisites":  sheet.prerequisites or "",
        "deliverables":   sheet.deliverables or [],
        "success_kpis":   sheet.success_kpis or [],
        "duration_hint":  sheet.duration_hint or "",
        "generated_by_ai":sheet.generated_by_ai or False,
        "updated_at":     sheet.updated_at,
    }


def _empty_sheet(template_id: str) -> dict:
    return {
        "id": None, "template_id": template_id,
        "objectives": "", "key_actions": [], "stakeholders": [],
        "prerequisites": "", "deliverables": [], "success_kpis": [],
        "duration_hint": "", "generated_by_ai": False, "updated_at": None,
    }


# ─── GET / UPSERT sheet d'un template ────────────────────────────────────────

@router.get("/templates/{template_id}/sheet")
def get_sheet(template_id: str, db: Session = Depends(get_db)):
    t = db.get(ProjectTemplate, template_id)
    if not t: raise HTTPException(404)
    sheet = db.query(ProjectTemplateSheet).filter_by(template_id=template_id).first()
    return _serialize_sheet(sheet) if sheet else _empty_sheet(template_id)


@router.put("/templates/{template_id}/sheet")
def upsert_sheet(template_id: str, body: SheetUpdate, db: Session = Depends(get_db)):
    t = db.get(ProjectTemplate, template_id)
    if not t: raise HTTPException(404)

    sheet = db.query(ProjectTemplateSheet).filter_by(template_id=template_id).first()
    if not sheet:
        sheet = ProjectTemplateSheet(template_id=template_id)
        db.add(sheet)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(sheet, field, value)

    db.commit()
    db.refresh(sheet)
    return _serialize_sheet(sheet)


# ─── Génération IA ────────────────────────────────────────────────────────────

@router.post("/templates/{template_id}/sheet/generate")
def generate_sheet(template_id: str, db: Session = Depends(get_db)):
    t = db.get(ProjectTemplate, template_id)
    if not t: raise HTTPException(404)

    # Contexte pour l'IA
    impacts_text = ""
    if t.impacts:
        impacts_text = ", ".join(
            f"{i.subdomain.code} (cible {i.maturity_target}/4)" for i in t.impacts
        )

    prompt = f"""Tu es un expert en excellence opérationnelle industrielle.

Génère une fiche chantier détaillée pour le chantier suivant :

Chantier : {t.label}
Description : {t.description or "Non renseignée"}
Sous-domaines impactés : {impacts_text or "Non renseignés"}
Effort estimé : {t.effort_default}
Impact estimé : {t.impact_default}

Génère une fiche opérationnelle et concrète, adaptée au contexte d'une PME industrielle.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après :

{{
  "objectives": "Objectifs principaux du chantier (2-3 phrases)",
  "key_actions": ["Action 1 concrète", "Action 2 concrète", "Action 3", "Action 4", "Action 5"],
  "stakeholders": ["Rôle 1 : responsabilité", "Rôle 2 : responsabilité", "Rôle 3 : responsabilité"],
  "prerequisites": "Prérequis nécessaires avant de lancer le chantier (1-2 phrases)",
  "deliverables": ["Livrable 1", "Livrable 2", "Livrable 3"],
  "success_kpis": ["KPI 1 avec valeur cible", "KPI 2 avec valeur cible", "KPI 3"],
  "duration_hint": "X-Y mois"
}}"""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        raw  = message.content[0].text.strip()
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            raise ValueError("No JSON found")
        data = json.loads(match.group())

    except Exception as e:
        raise HTTPException(500, f"Génération IA échouée : {e}")

    # Upsert
    sheet = db.query(ProjectTemplateSheet).filter_by(template_id=template_id).first()
    if not sheet:
        sheet = ProjectTemplateSheet(template_id=template_id)
        db.add(sheet)

    sheet.objectives     = data.get("objectives", "")
    sheet.key_actions    = data.get("key_actions", [])
    sheet.stakeholders   = data.get("stakeholders", [])
    sheet.prerequisites  = data.get("prerequisites", "")
    sheet.deliverables   = data.get("deliverables", [])
    sheet.success_kpis   = data.get("success_kpis", [])
    sheet.duration_hint  = data.get("duration_hint", "")
    sheet.generated_by_ai = True

    db.commit()
    db.refresh(sheet)
    return _serialize_sheet(sheet)


# ─── Fiches d'une campagne ────────────────────────────────────────────────────

@router.get("/campaigns/{campaign_id}/sheets")
def get_campaign_sheets(campaign_id: str, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign: raise HTTPException(404)

    items = (
        db.query(TransformationItem)
        .filter_by(campaign_id=campaign_id)
        .filter(TransformationItem.status != "excluded")
        .filter(TransformationItem.template_id.isnot(None))
        .order_by(TransformationItem.priority_rank)
        .all()
    )

    result = []
    for item in items:
        sheet = db.query(ProjectTemplateSheet)\
            .filter_by(template_id=item.template_id).first()
        result.append({
            "item_id":       item.id,
            "template_id":   item.template_id,
            "num":           item.priority_rank or 0,
            "label":         item.label_custom or item.recommendation_label,
            "domain_codes":  item.domain_codes,
            "effort":        item.effort,
            "impact":        item.impact,
            "phase":         item.phase or "moyen",
            "sheet":         _serialize_sheet(sheet) if sheet else _empty_sheet(item.template_id),
        })

    return result
