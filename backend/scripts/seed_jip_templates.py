"""
seed_jip_templates.py — loads 30 JIP transformation initiatives into the database.

Each initiative is linked to subdomains of the JIP framework (seed_jip_framework.py)
with absolute maturity targets (maturity_target = target level to reach).

Usage:
  python seed_jip_templates.py
  python seed_jip_templates.py --reset   # deletes seed templates and reloads
"""

import sys
from sqlalchemy.orm import Session
from database import engine, Base
from models import ProjectTemplate, ProjectTemplateImpact, Subdomain

# ─── 30 JIP initiatives ───────────────────────────────────────────────────────
# Format: label, description, effort, impact, [(subdomain_code, maturity_target), ...]

TEMPLATES = [

    # ── ORG: Governance & Capacity ────────────────────────────────────────────
    (
        "Deploy an SQDCP KPI governance system",
        "Define a centralised SQDCP dashboard, implement tier 1-2-3 reviews with gap analysis and traceable action tracking.",
        "moyen", "fort",
        [("ORG_GOV", 3)]
    ),
    (
        "Structure a continuous improvement (CI) system",
        "Create a CI funnel with effort/impact prioritisation, deploy standard methods (A3, VSM, SMED) and appoint trained Lean champions.",
        "fort", "fort",
        [("ORG_GOV", 3), ("ME_KPI", 3)]
    ),
    (
        "Deploy a skills matrix and training plan",
        "Formalise a 4-level skills/roles matrix for all functions with regular assessments and gap-based training plans.",
        "moyen", "moyen",
        [("ORG_CAP", 3), ("ME_STD", 3)]
    ),
    (
        "Implement a capacity model integrated into S&OP",
        "Model capacity by resource family and align it with the demand plan through the S&OP cycle, including the recruitment plan.",
        "fort", "fort",
        [("ORG_CAP", 3), ("PLAN_SOP", 3)]
    ),

    # ── PLAN: Planning & Logistics ────────────────────────────────────────────
    (
        "Formalise supply chain architecture and flow rules",
        "Map physical and information flows end-to-end, formalise SC rules (decoupling, storage, replenishment) and define a RACI.",
        "moyen", "moyen",
        [("PLAN_SC", 3)]
    ),
    (
        "Structure stock policies and the inventory cycle",
        "Define tiered stock policies by ABC segment (SS, reorder, coverage), deploy cycle counts and weekly coverage dashboards.",
        "moyen", "fort",
        [("PLAN_INV", 3)]
    ),
    (
        "Structure and cadence the S&OP process",
        "Implement a monthly cross-functional S&OP cycle in 5 steps (product, demand, supply, inventory, finance) with executive governance and adherence KPIs.",
        "moyen", "fort",
        [("PLAN_SOP", 3), ("ORG_GOV", 3)]
    ),
    (
        "Deploy long-term capacity planning (RCCP LT)",
        "Model capacity at 2-5 years by resource family, align with LRP and derive the CAPEX pipeline with customer capacity statement validation.",
        "fort", "fort",
        [("PLAN_SOP", 3)]
    ),
    (
        "Stabilise the Master Production Schedule (MPS)",
        "Define frozen/semi-frozen/flexible horizons, align MPS with RCCP and supply, implement MFT governance.",
        "moyen", "fort",
        [("PLAN_MPS", 3)]
    ),
    (
        "Deploy operational RCCP (Rough-Cut Capacity Plan)",
        "Formalise RCCP on all key resources with real parameters (CT, changeovers, yields), integrated into S&OP with structured action plans.",
        "fort", "fort",
        [("PLAN_MPS", 3)]
    ),
    (
        "Improve MRP reliability and master data governance",
        "Ensure ERP data quality (routings, BOMs, MRP parameters), implement exception and pegging routines, align MPS/purchasing.",
        "moyen", "fort",
        [("PLAN_MRP", 3)]
    ),
    (
        "Structure scheduling and work order tracking",
        "Define scheduling rules, deploy real-time WIP and work order visibility via MES, stabilise the short-term horizon with a controlled change process.",
        "fort", "fort",
        [("PLAN_MRP", 3)]
    ),
    (
        "Professionalise the purchasing process and order book management",
        "Standardise the PO process (issuance, confirmation, follow-up, escalation), improve order book reliability and deploy shortage prevention routines.",
        "moyen", "fort",
        [("PLAN_PROC", 3)]
    ),

    # ── SIM: Supplier Industrial Management ───────────────────────────────────
    (
        "Structure the supplier qualification process",
        "Deploy a cross-functional selection process with weighted criteria, on-site assessments for critical processes and ASL maintenance.",
        "moyen", "moyen",
        [("SIM_PERF", 3)]
    ),
    (
        "Deploy supplier scorecards and performance reviews",
        "Formalise supplier scorecards (OTD, OQD, NC backlog), hold regular reviews with action tracking and integrate performance into sourcing decisions.",
        "faible", "fort",
        [("SIM_PERF", 3)]
    ),
    (
        "Implement a supplier development programme",
        "Create a structured programme with MFT focal points, formalised problem solving (8D/RCA) and follow-up reviews with KPIs and milestones.",
        "moyen", "moyen",
        [("SIM_PERF", 3)]
    ),
    (
        "Deploy a supplier risk management model",
        "Formalise a multi-criteria risk assessment model, identify critical suppliers, maintain a risk register and deploy mitigation plans.",
        "moyen", "fort",
        [("SIM_RISK", 3)]
    ),

    # ── IQ: Industrialization & Quality ───────────────────────────────────────
    (
        "Deploy a structured QMS for non-conformity management",
        "Implement a standardised NCR workflow in a QMS with categorisation, traceability and regular trend analyses (Pareto, recurrences).",
        "moyen", "fort",
        [("IQ_NC", 3)]
    ),
    (
        "Formalise the containment and customer protection process",
        "Standardise containment procedures, reduce activation lead times, ensure traceability of contained lots and systematise customer notification.",
        "faible", "fort",
        [("IQ_NC", 3)]
    ),
    (
        "Deploy the 8D method for problem solving",
        "Train teams in the 8D method, deploy IS/IS NOT and 5-Why tools, implement corrective/preventive action tracking with effectiveness verification.",
        "moyen", "fort",
        [("IQ_NC", 3), ("SIM_PERF", 3)]
    ),
    (
        "Structure industrial change management",
        "Formalise a multi-criteria change workflow, systematise MFT teams and FAIs with post-FAI tracking through ramp-up.",
        "moyen", "moyen",
        [("IQ_CHANGE", 3)]
    ),
    (
        "Deploy a product preservation and FOD prevention programme",
        "Formalise handling/packaging/storage rules, deploy the FOD programme (zoning, tool control) and implement regular layered audits.",
        "moyen", "moyen",
        [("IQ_PRES", 3)]
    ),

    # ── ME: Manufacturing Excellence ──────────────────────────────────────────
    (
        "Optimise shop floor layout and physical flows",
        "Apply layout standards across the entire shop floor, ensure pedestrian/material separation and reinforce visual management (5S, flows, FIFO).",
        "moyen", "moyen",
        [("ME_FLOW", 3)]
    ),
    (
        "Control lead times and manage bottlenecks",
        "Establish a lead time baseline by family, conduct regular VSMs with time studies, set WIP limits by workstation and track reduction plans.",
        "moyen", "fort",
        [("ME_FLOW", 3)]
    ),
    (
        "Deploy 5S and HSE culture across the shop floor",
        "Standardise and audit 5S on all workstations, assess and mitigate HSE risks, and anchor a safety culture with zero tolerance for deviations.",
        "faible", "fort",
        [("ME_STD", 3)]
    ),
    (
        "Formalise and deploy standardised work instructions",
        "Cover all workstations with up-to-date work instructions (key steps, safety, quality), available at point of use with a formal update process.",
        "moyen", "fort",
        [("ME_STD", 3)]
    ),
    (
        "Deploy and sustain SQCDP rituals at all levels",
        "Structure tier 1-2-3 rituals with daily indicator updates, problem solving at the right level and disciplined action tracking.",
        "faible", "fort",
        [("ME_KPI", 3)]
    ),
    (
        "Align production rate with MPS in real time",
        "Make progress vs plan visible in real time by line, define proactive correction mechanisms and ensure MPS/production plan/actuals alignment.",
        "moyen", "fort",
        [("ME_KPI", 3), ("PLAN_MPS", 3)]
    ),
    (
        "Deploy QRQC (Quick Response Quality Control) at line level",
        "Structure QRQC meetings at line level with rapid problem detection, action implementation within deadlines and integration into the NC system.",
        "faible", "moyen",
        [("ME_KPI", 3), ("IQ_NC", 3)]
    ),
    (
        "Deploy a TPM strategy on critical equipment",
        "Deploy autonomous and planned maintenance on key equipment, measure OEE regularly and drive actions based on criticality and MTBF/MTTR.",
        "moyen", "fort",
        [("ME_EQP", 3)]
    ),
    (
        "Implement an end-to-end traceability system",
        "Standardise and verify material/part/process traceability against aerospace requirements, with reliable and retrievable records for audits and investigations.",
        "moyen", "fort",
        [("IQ_PRES", 3), ("ME_EQP", 3)]
    ),
]


def seed_jip_templates(reset: bool = False):
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # Index subdomain_code → id
        subdomains = session.query(Subdomain).all()
        if not subdomains:
            print("[ERROR] No subdomains in database — run seed_jip_framework.py first")
            sys.exit(1)

        sd_map = {sd.code: sd.id for sd in subdomains}

        if reset:
            existing = session.query(ProjectTemplate).filter_by(source="seed").all()
            for t in existing:
                session.delete(t)
            session.commit()
            print(f"[INFO] {len(existing)} seed templates deleted")

        created, skipped = 0, 0

        for label, description, effort, impact, impacts in TEMPLATES:
            if session.query(ProjectTemplate).filter_by(label=label).first():
                skipped += 1
                continue

            t = ProjectTemplate(
                label          = label,
                description    = description,
                effort_default = effort,
                impact_default = impact,
                source         = "seed",
                active         = True,
            )
            session.add(t)
            session.flush()

            for sd_code, target in impacts:
                sd_id = sd_map.get(sd_code)
                if not sd_id:
                    print(f"  [WARN] Subdomain '{sd_code}' not found — impact ignored")
                    continue
                session.add(ProjectTemplateImpact(
                    template_id    = t.id,
                    subdomain_id   = sd_id,
                    maturity_target = float(target),
                ))
            created += 1

        session.commit()
        print(f"[OK] {created} JIP initiatives created, {skipped} skipped (duplicates)")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    seed_jip_templates(reset=reset)
