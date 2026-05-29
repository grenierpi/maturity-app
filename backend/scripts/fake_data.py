"""
fake_data.py — crée des fournisseurs et campagnes de test basés sur le framework JIP.

Prérequis : seed_jip_framework.py doit avoir été lancé avant.

Usage :
  python fake_data.py                    # crée les données (skip si déjà présentes)
  python fake_data.py --reset            # supprime et recrée
  python fake_data.py --skip-framework   # ne touche pas au framework (utilisé par start.sh)
"""
import sys
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, Base
from models import (
    Domain, Subdomain, Question, Criterion,
    Supplier, Campaign, CriterionResponse, SubdomainScore,
    TransformationItem, ProjectTemplate, ProjectTemplateImpact
)
from scoring import compute_all_scores

random.seed(42)

# ─── Fournisseurs ─────────────────────────────────────────────────────────────

SUPPLIERS = [
    {"name": "Acier Dupont SAS",     "sector": "Sidérurgie",   "country": "FR"},
    {"name": "Plastics Müller GmbH", "sector": "Plasturgie",   "country": "DE"},
    {"name": "Mécano Ibérica SA",    "sector": "Mécanique",    "country": "ES"},
]


def seed_suppliers(session: Session) -> list:
    suppliers = []
    for s_data in SUPPLIERS:
        s = Supplier(**s_data)
        session.add(s)
        session.flush()
        suppliers.append(s)
    session.commit()
    return suppliers


def seed_campaigns(session: Session, suppliers: list):
    """Crée 3 campagnes de test avec des scores réalistes basés sur le framework JIP."""

    # Vérifier que le framework JIP est bien chargé
    domains = session.query(Domain).filter(
        Domain.code.in_(["ORG", "PLAN", "SIM", "IQ", "ME"])
    ).all()

    if len(domains) < 5:
        print(f"  [WARN] Framework JIP incomplet ({len(domains)}/5 domaines) — campagnes sans scores")
        # Créer les campagnes sans les initialiser
        for i, (supplier, scope, title, consultant, status) in enumerate([
            (suppliers[0], ["ORG", "PLAN", "SIM", "IQ", "ME"], "Audit maturité Q1 2026", "Sophie Martin", "IN_PROGRESS"),
            (suppliers[1], ["PLAN", "SIM", "IQ"],               "Évaluation supply chain",  "Thomas Renard",  "IN_PROGRESS"),
            (suppliers[2], ["ME", "IQ", "ORG"],                  "Audit maturité initial",   "Sophie Martin",  "IN_PROGRESS"),
        ]):
            c = Campaign(
                supplier_id     = supplier.id,
                title           = title,
                consultant_name = consultant,
                domain_scope    = scope,
                status          = "DRAFT",
                created_at      = datetime.utcnow() - timedelta(days=random.randint(5, 30)),
            )
            session.add(c)
        session.commit()
        return

    CAMPAIGNS = [
        (suppliers[0], ["ORG", "PLAN", "SIM", "IQ", "ME"], "Audit maturité Q1 2026",   "Sophie Martin", "COMPLETED", "mixed"),
        (suppliers[1], ["PLAN", "SIM", "IQ"],               "Évaluation supply chain",  "Thomas Renard", "IN_PROGRESS", "partial"),
        (suppliers[2], ["ME", "IQ", "ORG"],                  "Audit maturité initial",   "Sophie Martin", "COMPLETED", "low"),
    ]

    for supplier, scope, title, consultant, status, profile in CAMPAIGNS:
        c = Campaign(
            supplier_id     = supplier.id,
            title           = title,
            consultant_name = consultant,
            domain_scope    = scope,
            status          = "IN_PROGRESS",
            created_at      = datetime.utcnow() - timedelta(days=random.randint(5, 30)),
        )
        session.add(c)
        session.flush()

        # Charger les critères du périmètre
        criteria = (
            session.query(Criterion)
            .join(Question, Criterion.question_id == Question.id)
            .join(Subdomain, Question.subdomain_id == Subdomain.id)
            .join(Domain, Subdomain.domain_id == Domain.id)
            .filter(Domain.code.in_(scope))
            .all()
        )

        if not criteria:
            print(f"  [WARN] Aucun critère pour le scope {scope}")
            continue

        for criterion in criteria:
            score = _pick_score(profile)
            session.add(CriterionResponse(
                campaign_id  = c.id,
                criterion_id = criterion.id,
                score        = score,
                comment      = _pick_comment(score) if score is not None and score <= 1 else None,
                flagged      = (score == 0 and random.random() < 0.3),
            ))

        session.commit()

        try:
            compute_all_scores(c.id, session)
        except Exception as e:
            print(f"  [WARN] Scoring échoué pour {title}: {e}")

        c.status = status
        session.commit()
        print(f"  [{status}] {title} — {supplier.name} ({len(criteria)} critères)")


def _pick_score(profile):
    if profile == "partial":
        if random.random() < 0.4:
            return None
        return random.choices([0,1,2,3,4], weights=[5,15,35,35,10])[0]
    elif profile == "low":
        return random.choices([0,1,2,3,4], weights=[25,35,25,12,3])[0]
    else:
        return random.choices([0,1,2,3,4], weights=[8,20,30,30,12])[0]


def _pick_comment(score):
    c0 = ["Processus absent.", "Pratique ad hoc uniquement.", "Non applicable selon l'interlocuteur."]
    c1 = ["Existe de façon informelle.", "Pratiqué sur certains produits.", "En cours de déploiement."]
    return random.choice(c0 if score == 0 else c1)


# ─── Main ─────────────────────────────────────────────────────────────────────

def run(reset=False, skip_framework=False):
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        existing_suppliers = session.query(Supplier).count()

        if existing_suppliers > 0 and not reset:
            print("[INFO] Des données de test existent déjà. Utilisez --reset pour repartir de zéro.")
            return

        if reset:
            # Supprimer uniquement les données opérationnelles
            for model in [TransformationItem, SubdomainScore,
                          CriterionResponse, Campaign, Supplier]:
                session.query(model).delete()
            # Supprimer aussi les templates si pas skip_framework
            if not skip_framework:
                session.query(ProjectTemplateImpact).delete()
                session.query(ProjectTemplate).delete()
                for table in ['criteria','questions','subdomains','domains']:
                    session.execute(__import__('sqlalchemy').text(f'DELETE FROM {table}'))
            session.commit()

        print("[INFO] Génération des données de test…")
        suppliers = seed_suppliers(session)
        print(f"  {len(suppliers)} fournisseurs créés")

        seed_campaigns(session, suppliers)
        print("[OK] Dataset prêt")


if __name__ == "__main__":
    reset          = "--reset"          in sys.argv
    skip_framework = "--skip-framework" in sys.argv
    run(reset=reset, skip_framework=skip_framework)
