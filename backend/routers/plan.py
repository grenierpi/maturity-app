from __future__ import annotations
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Campaign, TransformationItem, ProjectTemplate,
    ProjectTemplateImpact, Subdomain, Domain
)

router = APIRouter(prefix="/campaigns", tags=["plan"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ItemUpdate(BaseModel):
    effort:             Optional[str]  = None
    impact:             Optional[str]  = None
    priority_rank:      Optional[int]  = None
    status:             Optional[str]  = None
    exclusion_reason:   Optional[str]  = None
    label_custom:       Optional[str]  = None
    description_custom: Optional[str]  = None
    template_id:        Optional[str]  = None
    subdomain_codes:    Optional[list] = None
    domain_codes:       Optional[list] = None


class ItemCreate(BaseModel):
    """Création d'un chantier custom depuis l'interface plan — logué dans le catalogue."""
    label:              str
    description:        Optional[str] = None
    effort:             str = "moyen"
    impact:             str = "moyen"
    subdomain_codes:    list[str] = []
    domain_codes:       list[str] = []
    impacts:            list[dict] = []   # [{subdomain_id, maturity_target}]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_item(item: TransformationItem) -> dict:
    label       = item.label_custom or item.recommendation_label
    description = item.description_custom or item.description
    return {
        "id":                  item.id,
        "template_id":         item.template_id,
        "source":              item.source,
        "label":               label,
        "label_original":      item.recommendation_label,
        "label_custom":        item.label_custom,
        "description":         description,
        "description_original":item.description,
        "description_custom":  item.description_custom,
        "domain_codes":        item.domain_codes,
        "subdomain_codes":     item.subdomain_codes,
        "effort":              item.effort,
        "impact":              item.impact,
        "priority_rank":       item.priority_rank,
        "status":              item.status,
        "exclusion_reason":    item.exclusion_reason,
        # Impacts du template associé (pour affichage)
        "template_impacts": [
            {
                "subdomain_id":    i.subdomain_id,
                "subdomain_code":  i.subdomain.code,
                "subdomain_label": i.subdomain.label,
                "domain_code":     i.subdomain.domain.code,
                "maturity_target":   i.maturity_target,
            }
            for i in (item.template.impacts if item.template else [])
        ],
    }


# ─── Endpoints plan ───────────────────────────────────────────────────────────

@router.get("/{campaign_id}/plan")
def get_plan(campaign_id: str, db: Session = Depends(get_db)):
    if not db.get(Campaign, campaign_id):
        raise HTTPException(404)
    items = (
        db.query(TransformationItem)
        .filter_by(campaign_id=campaign_id)
        .order_by(TransformationItem.priority_rank)
        .all()
    )
    return [_serialize_item(i) for i in items]


@router.post("/{campaign_id}/plan", status_code=201)
def create_item(
    campaign_id: str, body: ItemCreate, db: Session = Depends(get_db)
):
    """
    Crée un chantier custom :
    1. Logué dans ProjectTemplate (source=manual) avec ses impacts
    2. Instancié comme TransformationItem sur la campagne
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)

    # 1. Créer le template dans le catalogue
    template = ProjectTemplate(
        label          = body.label,
        description    = body.description,
        effort_default = body.effort,
        impact_default = body.impact,
        source         = "manual",
    )
    db.add(template)
    db.flush()

    for imp in body.impacts:
        gain = max(0.0, min(4.0, float(imp.get("maturity_target", 0))))
        db.add(ProjectTemplateImpact(
            template_id   = template.id,
            subdomain_id  = imp["subdomain_id"],
            maturity_target = gain,
        ))

    # 2. Instancier sur la campagne
    existing_count = db.query(TransformationItem).filter_by(campaign_id=campaign_id).count()
    item = TransformationItem(
        campaign_id          = campaign_id,
        template_id          = template.id,
        source               = "manual",
        recommendation_label = body.label,
        description          = body.description,
        domain_codes         = body.domain_codes,
        subdomain_codes      = body.subdomain_codes,
        effort               = body.effort,
        impact               = body.impact,
        priority_rank        = existing_count + 1,
        status               = "proposed",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_item(item)


@router.patch("/{campaign_id}/plan/{item_id}")
def update_item(
    campaign_id: str, item_id: str,
    body: ItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(TransformationItem, item_id)
    if not item or item.campaign_id != campaign_id:
        raise HTTPException(404)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return _serialize_item(item)


@router.delete("/{campaign_id}/plan/{item_id}")
def delete_item(campaign_id: str, item_id: str, db: Session = Depends(get_db)):
    item = db.get(TransformationItem, item_id)
    if not item or item.campaign_id != campaign_id:
        raise HTTPException(404)
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{campaign_id}/plan/{item_id}/link-template")
def link_template(
    campaign_id: str, item_id: str,
    template_id: str, db: Session = Depends(get_db)
):
    """Associe un template existant du catalogue à un chantier de campagne."""
    item = db.get(TransformationItem, item_id)
    if not item or item.campaign_id != campaign_id:
        raise HTTPException(404)
    template = db.get(ProjectTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    item.template_id = template_id
    db.commit()
    db.refresh(item)
    return _serialize_item(item)


@router.post("/{campaign_id}/plan/from-template/{template_id}", status_code=201)
def add_from_template(
    campaign_id: str, template_id: str, db: Session = Depends(get_db)
):
    """Instancie un chantier du catalogue sur la campagne."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404)
    template = db.get(ProjectTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")

    # Vérifier si déjà instancié
    existing = db.query(TransformationItem).filter_by(
        campaign_id=campaign_id, template_id=template_id
    ).first()
    if existing:
        raise HTTPException(409, "This initiative is already in the plan")

    count = db.query(TransformationItem).filter_by(campaign_id=campaign_id).count()
    domain_codes = list({
        i.subdomain.domain.code for i in template.impacts
    }) if template.impacts else []
    subdomain_codes = [i.subdomain.code for i in template.impacts]

    item = TransformationItem(
        campaign_id          = campaign_id,
        template_id          = template_id,
        source               = "template",
        recommendation_label = template.label,
        description          = template.description,
        domain_codes         = domain_codes,
        subdomain_codes      = subdomain_codes,
        effort               = template.effort_default,
        impact               = template.impact_default,
        priority_rank        = count + 1,
        status               = "proposed",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_item(item)
