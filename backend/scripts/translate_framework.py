"""
translate_framework.py — Traduit le framework JIP en français via Claude API.
Génère frontend/src/i18n/framework_fr.json (questions + critères inclus).

Usage : python translate_framework.py
"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database import SessionLocal
from models import Domain, Subdomain, Question, Criterion
import anthropic
from database import settings

OUTPUT = Path(__file__).parent.parent.parent / "frontend" / "src" / "i18n" / "framework_fr.json"

def translate_batch(client, items: list[dict], item_type: str) -> dict:
    """Traduit une liste d'items via Claude. Retourne un dict {id/code: traduction}."""
    prompt = f"""Translate the following {item_type} from English to French (concise, professional, keep technical terms when appropriate).
Respond ONLY with a valid JSON object mapping each "id" to its French translation.

Items:
{json.dumps(items, ensure_ascii=False, indent=2)}

Response format:
{{"<id>": "<French translation>", ...}}"""

    msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    import re
    match = re.search(r'\{.*\}', msg.content[0].text, re.DOTALL)
    return json.loads(match.group()) if match else {}

def main():
    db = SessionLocal()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    result = {"domains": {}, "subdomains": {}, "questions": {}, "criteria": {}}

    # Domaines
    domains = db.query(Domain).order_by(Domain.order_index).all()
    items = [{"id": d.code, "text": d.label} for d in domains]
    result["domains"] = translate_batch(client, items, "domain labels")
    print(f"✓ {len(result['domains'])} domains translated")

    # Sous-domaines
    subdomains = db.query(Subdomain).all()
    items = [{"id": sd.code, "text": sd.label} for sd in subdomains]
    result["subdomains"] = translate_batch(client, items, "subdomain labels")
    print(f"✓ {len(result['subdomains'])} subdomains translated")

    # Questions (par batches de 10)
    questions = db.query(Question).all()
    for i in range(0, len(questions), 10):
        batch = questions[i:i+10]
        items = [{"id": q.id, "text": q.text, "guidance": q.guidance or ""} for q in batch]
        translated = translate_batch(client, items, "questions (translate 'text' and 'guidance' fields)")
        result["questions"].update(translated)
    print(f"✓ {len(result['questions'])} questions translated")

    # Critères (par batches de 15)
    criteria = db.query(Criterion).all()
    for i in range(0, len(criteria), 15):
        batch = criteria[i:i+15]
        items = [{"id": c.id, "text": c.text, "hint": c.verification_hint or ""} for c in batch]
        translated = translate_batch(client, items, "criteria (translate 'text' and 'hint' fields)")
        result["criteria"].update(translated)
    print(f"✓ {len(result['criteria'])} criteria translated")

    db.close()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\n✓ Saved to {OUTPUT}")

if __name__ == "__main__":
    main()
