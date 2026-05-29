from __future__ import annotations
"""
generation.py — génération des chantiers de transformation via Claude API.
Les données client sont anonymisées avant l'appel LLM.
"""
import json
import re
import logging
from sqlalchemy.orm import Session
import anthropic

from database import settings
from models import (
    Campaign, SubdomainScore, Subdomain, Domain,
    CriterionResponse, Criterion, Question, TransformationItem
)

logger = logging.getLogger(__name__)

GAP_THRESHOLD    = 1.0
MAX_CHANTIERS    = 8
LLM_TIMEOUT_SECS = 30


# ─── 1. Gap Analyzer ─────────────────────────────────────────────────────────

def analyze_gaps(campaign_id: str, db: Session) -> list[dict]:
    scores = (
        db.query(SubdomainScore)
        .join(Subdomain, SubdomainScore.subdomain_id == Subdomain.id)
        .join(Domain, Subdomain.domain_id == Domain.id)
        .filter(
            SubdomainScore.campaign_id == campaign_id,
            SubdomainScore.score_computed.isnot(None),
        )
        .order_by(Domain.order_index, Subdomain.order_index)
        .all()
    )

    gaps = []
    for ss in scores:
        gap = ss.score_target - (ss.score_computed or 0)
        if gap < GAP_THRESHOLD:
            continue

        weak_criteria = (
            db.query(CriterionResponse)
            .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
            .join(Question, Criterion.question_id == Question.id)
            .filter(
                CriterionResponse.campaign_id == campaign_id,
                Question.subdomain_id == ss.subdomain_id,
                CriterionResponse.score <= 1,
                CriterionResponse.score.isnot(None),
            )
            .all()
        )

        gaps.append({
            "domain_code":     ss.subdomain.domain.code,
            "domain_label":    ss.subdomain.domain.label,
            "subdomain_code":  ss.subdomain.code,
            "subdomain_label": ss.subdomain.label,
            "score":           round(ss.score_computed, 2),
            "target":          ss.score_target,
            "gap":             round(gap, 2),
            "weak_criteria": [
                {
                    "text":  r.criterion.text,
                    "score": r.score,
                }
                for r in weak_criteria
            ],
        })

    return gaps


# ─── 2. Prompt Builder ───────────────────────────────────────────────────────

def build_prompt(gaps: list[dict], nb_chantiers: int = MAX_CHANTIERS) -> str:
    gaps_text = ""
    for g in gaps:
        gaps_text += (
            f"\nDomaine {g['domain_label']} — {g['subdomain_label']} : "
            f"score {g['score']}/4 (cible {g['target']}/4, gap {g['gap']})\n"
        )
        for c in g["weak_criteria"]:
            gaps_text += f"  - {c['text']} : score {c['score']}/4\n"

    return f"""Tu es un expert en excellence opérationnelle industrielle \
(lean manufacturing, supply chain, qualité, maintenance).

Un audit de maturité a été conduit sur un site industriel. \
Voici les gaps identifiés par domaine :
{gaps_text}
Génère exactement {nb_chantiers} chantiers de transformation consolidés \
et priorisés pour ce site.

Règles :
- Chaque chantier peut couvrir plusieurs sous-domaines si les gaps sont liés
- Formule les chantiers de façon concrète et actionnable (pas générique)
- Calibre effort et impact sur un contexte PME industrielle
- Ne mentionne pas de noms d'entreprise ni de secteur spécifique

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, \
sans balises markdown, au format suivant :

{{
  "chantiers": [
    {{
      "label": "Intitulé court du chantier (max 10 mots)",
      "description": "Description concrète en 2 phrases maximum",
      "domain_codes": ["PLAN"],
      "subdomain_codes": ["PLAN_SOP"],
      "effort": "faible",
      "impact": "fort"
    }}
  ]
}}"""


# ─── 3. Appel Claude + 4. Parser ─────────────────────────────────────────────

def call_claude(prompt: str, max_retries: int = 2) -> list[dict]:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    for attempt in range(max_retries + 1):
        try:
            message = client.messages.create(
                model      = "claude-sonnet-4-20250514",
                max_tokens = 2000,
                messages   = [{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            return parse_llm_response(raw)

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Parse attempt {attempt+1} failed: {e}")
            if attempt >= max_retries:
                raise RuntimeError(f"LLM parse failed after {max_retries+1} attempts: {e}")

        except anthropic.APIError as e:
            raise RuntimeError(f"Anthropic API error: {e}")

    return []


def parse_llm_response(raw: str) -> list[dict]:
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not json_match:
        raise ValueError("No JSON object found in LLM response")

    data = json.loads(json_match.group())

    if "chantiers" not in data or not isinstance(data["chantiers"], list):
        raise ValueError("Missing 'chantiers' key in LLM response")

    validated = []
    for item in data["chantiers"]:
        if not item.get("label"):
            continue
        effort = item.get("effort", "moyen")
        impact = item.get("impact", "moyen")
        validated.append({
            "label":           str(item["label"])[:200],
            "description":     str(item.get("description", ""))[:500],
            "domain_codes":    item.get("domain_codes", []),
            "subdomain_codes": item.get("subdomain_codes", []),
            "effort":          effort if effort in ("faible", "moyen", "fort") else "moyen",
            "impact":          impact if impact in ("faible", "moyen", "fort") else "moyen",
            "source":          "llm",
        })

    if not validated:
        raise ValueError("No valid initiatives parsed from LLM response")

    return validated


# ─── 5. Merger templates + LLM ───────────────────────────────────────────────

def merge_with_templates(
    campaign_id: str, llm_items: list[dict], db: Session
) -> list[dict]:
    template_rows = (
        db.query(CriterionResponse, Criterion)
        .join(Criterion, CriterionResponse.criterion_id == Criterion.id)
        .join(Question, Criterion.question_id == Question.id)
        .join(Subdomain, Question.subdomain_id == Subdomain.id)
        .filter(
            CriterionResponse.campaign_id == campaign_id,
            CriterionResponse.score <= 1,
            Criterion.recommendation_label.isnot(None),
            Criterion.recommendation_label != "",
        )
        .all()
    )

    llm_labels = {item["label"].lower()[:40] for item in llm_items}

    static = []
    seen_labels = set()
    for response, criterion in template_rows:
        label = criterion.recommendation_label
        key   = label.lower()[:40]
        if key in seen_labels:
            continue
        if any(key in ll for ll in llm_labels):
            continue
        seen_labels.add(key)
        static.append({
            "label":           label,
            "description":     "",
            "domain_codes":    [criterion.question.subdomain.domain.code],
            "subdomain_codes": [criterion.question.subdomain.code],
            "effort":          criterion.effort_default or "moyen",
            "impact":          criterion.impact_default or "moyen",
            "source":          "template",
        })

    return llm_items + static


# ─── Orchestrateur principal ──────────────────────────────────────────────────

def generate_transformation_items(campaign_id: str, db: Session) -> dict:
    gaps = analyze_gaps(campaign_id, db)
    if not gaps:
        return {"generated": 0, "from_llm": 0, "from_templates": 0, "items": []}

    nb = min(len(gaps) * 2, MAX_CHANTIERS)
    prompt = build_prompt(gaps, nb_chantiers=nb)

    llm_items = []
    llm_error  = None
    try:
        llm_items = call_claude(prompt)
    except RuntimeError as e:
        llm_error = str(e)
        logger.error(f"LLM generation failed, falling back to templates: {e}")

    all_items = merge_with_templates(campaign_id, llm_items, db)

    # Supprimer uniquement les proposed (préserver accepted/excluded)
    db.query(TransformationItem).filter_by(
        campaign_id=campaign_id, status="proposed"
    ).delete()

    for i, item in enumerate(all_items):
        db.add(TransformationItem(
            campaign_id          = campaign_id,
            source               = item.get("source", "llm"),
            recommendation_label = item["label"],
            description          = item.get("description", ""),
            domain_codes         = item.get("domain_codes", []),
            subdomain_codes      = item.get("subdomain_codes", []),
            effort               = item["effort"],
            impact               = item["impact"],
            priority_rank        = i + 1,
            status               = "proposed",
        ))

    db.commit()

    result = {
        "generated":      len(all_items),
        "from_llm":       sum(1 for x in all_items if x.get("source") == "llm"),
        "from_templates": sum(1 for x in all_items if x.get("source") == "template"),
        "items": [
            {
                "id":     item.id,
                "label":  item.recommendation_label,
                "effort": item.effort,
                "impact": item.impact,
                "source": item.source,
            }
            for item in db.query(TransformationItem)
                          .filter_by(campaign_id=campaign_id)
                          .order_by(TransformationItem.priority_rank)
                          .all()
        ],
    }
    if llm_error:
        result["llm_error"] = llm_error

    return result
