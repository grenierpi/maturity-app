"""
seed_jip_framework.py — loads the JIP Capgemini framework into the database.

The framework is encoded directly in this script (extracted from the file
Capgemini_JIP_Assessment_Framework.xlsx).

Usage:
  python seed_jip_framework.py             # load (fails if data already exists)
  python seed_jip_framework.py --reset     # erase and reload
  python seed_jip_framework.py --dry-run   # validate without writing
"""

import sys
from sqlalchemy.orm import Session
from database import engine, Base
from models import Domain, Subdomain, Question, Criterion

# ─── JIP Framework ────────────────────────────────────────────────────────────
# Structure: domain > subdomain > question
# Each question has 4 maturity levels (descriptions L1→L4)
# Criteria = key points for level 3 (realistic operational target)

FRAMEWORK = [
    {
        "code": "ORG", "label": "Org & Resource Management", "weight": 1.0,
        "subdomains": [
            {
                "code": "ORG_GOV", "label": "Company Governance", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are operational objectives translated into KPIs, tracked and governed?",
                        "guidance": "Assess the existence of an SQDCP dashboard, the cadence of reviews and the traceability of corrective actions.",
                        "criteria": [
                            ("KPI dashboard defined (OTD, OQD, productivity, safety)", "Request existing dashboards"),
                            ("Periodic tier 1-2-3 reviews with gap analysis", "Check meeting schedules and minutes"),
                            ("Actions tracked with owners and due dates", "Request the action plan for the last 3 months"),
                            ("KPIs defined and calculated centrally", "Verify consistency of definitions across sites"),
                        ]
                    },
                    {
                        "text": "How are improvement opportunities identified, prioritised and sustained?",
                        "guidance": "Check for a formalised CI system (funnel, methods, roles), distinct from ad hoc problem solving.",
                        "criteria": [
                            ("CI funnel with effort/impact prioritisation", "Request CI backlog and prioritisation method"),
                            ("Standard methods deployed (A3, VSM, SMED)", "Check initiatives completed over 12 months"),
                            ("CI roles defined (Lean champions) and teams trained", "Request CI org chart and training plans"),
                            ("Gains measured and sustained (follow-up audits)", "Check documented gains post-initiative"),
                        ]
                    },
                ]
            },
            {
                "code": "ORG_CAP", "label": "Load & Capacity Management", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are skills assessed, maintained and developed to meet operational needs?",
                        "guidance": "Check for an up-to-date skills matrix by role across all functions, with an associated training plan.",
                        "criteria": [
                            ("Skills/roles matrix deployed across all functions (4 levels)", "Request the matrix and its last update date"),
                            ("Regular assessments and gap-based training plans", "Check appraisals and training plans"),
                            ("Certification tracking with renewal alerts", "Request the certification register"),
                            ("Coverage and versatility KPIs tracked", "Check versatility rate by line"),
                        ]
                    },
                    {
                        "text": "How is capacity and workload planned and aligned with demand?",
                        "guidance": "Check for a capacity model by resource family, integrated into S&OP.",
                        "criteria": [
                            ("Capacity model by resource family", "Request capacity planning files"),
                            ("HR and training plans aligned with demand", "Check consistency of workload plan / recruitment plan"),
                            ("Succession plan for key roles", "Request list of critical roles and backups"),
                            ("Share of temporary work < 40% on non-critical activities", "Check contractual structure by role"),
                        ]
                    },
                ]
            },
        ]
    },
    {
        "code": "PLAN", "label": "Planning & Logistics", "weight": 1.0,
        "subdomains": [
            {
                "code": "PLAN_SC", "label": "Supply Chain Architecture", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are supply chain rules, physical/information flows and improvement roadmaps defined and maintained?",
                        "guidance": "Check for an end-to-end flow map and formalised SC rules (decoupling, storage, replenishment).",
                        "criteria": [
                            ("Physical and information flow maps for all products", "Request VSMs and flow diagrams"),
                            ("Formalised SC rules (lot sizes, decoupling points, replenishment logic)", "Check SC rules documentation"),
                            ("RACI and SC rules ownership clearly defined", "Request SC RACI"),
                            ("Medium/long-term roadmap with milestones and owners", "Request SC roadmap"),
                        ]
                    },
                ]
            },
            {
                "code": "PLAN_INV", "label": "Inventory Policy & Management", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are stock policies defined, applied and reviewed for make/buy items?",
                        "guidance": "Check for formalised stock policies by segment with regular coverage reviews.",
                        "criteria": [
                            ("Tiered policies for all SKUs (SS, reorder, lead time, variability)", "Request stock parameters by ABC"),
                            ("Cycle counts, stock accuracy KPIs", "Check inventory results and accuracy rates"),
                            ("Weekly coverage dashboards and exception-based management", "Request weekly coverage report"),
                        ]
                    },
                ]
            },
            {
                "code": "PLAN_SOP", "label": "Sales & Operational Planning", "weight": 1.2,
                "questions": [
                    {
                        "text": "How are demand, supply and financial plans reconciled in S&OP?",
                        "guidance": "Check for a structured S&OP cycle with product/demand/supply/inventory/finance reviews.",
                        "criteria": [
                            ("Formalised cross-functional S&OP cycle (5 steps)", "Request S&OP agenda and last 3 months' minutes"),
                            ("Scenario-based decisions with actions and owners", "Check S&OP decision minutes"),
                            ("Plan adherence KPIs tracked", "Request MPS vs S&OP plan adherence rate"),
                        ]
                    },
                    {
                        "text": "How is long-term capacity (2-5 years) assessed and aligned with the demand plan?",
                        "guidance": "Check for a long-term capacity model with a derived CAPEX pipeline.",
                        "criteria": [
                            ("Modelling by resource family with yields and changeover times", "Request LT capacity models"),
                            ("Alignment to LRP, CAPEX pipeline derived", "Check S&OP → CAPEX link"),
                            ("Capacity statements validated by customers", "Request customer capacity commitments"),
                        ]
                    },
                ]
            },
            {
                "code": "PLAN_MPS", "label": "Master Production Scheduling", "weight": 1.2,
                "questions": [
                    {
                        "text": "How is the master production schedule built, frozen and controlled?",
                        "guidance": "Check for frozen/flexible horizons, RCCP alignment and multi-function governance.",
                        "criteria": [
                            ("Formal MPS with defined frozen/semi-frozen/flexible horizons", "Request MPS freeze policy"),
                            ("MPS aligned with RCCP, materials and S&OP", "Check MPS / capacity / supply consistency"),
                            ("Multi-functional governance, plan considered stable", "Request MPS adherence KPIs"),
                        ]
                    },
                    {
                        "text": "How is capacity roughly checked against the MPS on critical resources?",
                        "guidance": "Check for a formalised RCCP on all key resources, integrated into the S&OP process.",
                        "criteria": [
                            ("RCCP formalised on all key resources (machines, skills, tooling)", "Request RCCP files"),
                            ("Load models based on real parameters (CT, changeovers, yields)", "Check routing and capacity database"),
                            ("Structured action plans for each critical gap", "Request capacity action plans"),
                        ]
                    },
                ]
            },
            {
                "code": "PLAN_MRP", "label": "MRP & Detailed Scheduling", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are material requirements planned, launched and controlled?",
                        "guidance": "Check MRP reliability, master data quality and exception management routines.",
                        "criteria": [
                            ("MRP drives decisions with reliable master data", "Check ERP data reliability rate (routings, BOMs)"),
                            ("Exception review routines and pegging in place", "Request weekly MRP exception reports"),
                            ("Parameters regularly reviewed, MPS/purchasing alignment", "Check MRP parameter review frequency"),
                        ]
                    },
                    {
                        "text": "How are work orders scheduled, released and controlled on the shop floor?",
                        "guidance": "Check for formalised scheduling rules and real-time visibility on work order progress.",
                        "criteria": [
                            ("Scheduling rules defined (dispatch, batch, setup/tooling/skill constraints)", "Request documented scheduling rules"),
                            ("Real-time visibility via MES: work order status, WIP by workstation", "Check shop floor tracking tool"),
                            ("Short-term horizon frozen, changes controlled and justified", "Request short-term freeze policy"),
                        ]
                    },
                ]
            },
            {
                "code": "PLAN_PROC", "label": "Procurement", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are purchases planned, placed and tracked with suppliers?",
                        "guidance": "Check for a standardised purchasing process with a reliable order book and shortage prevention routines.",
                        "criteria": [
                            ("Standardised order process (issuance, confirmation, follow-up, escalation)", "Request purchasing procedure and confirmation lead times"),
                            ("Systematic tracking and updating of the order book", "Check order book accuracy"),
                            ("Shortage prevention routines (coverage control, exception management)", "Request supplier coverage reports"),
                            ("Supplier OTD, confirmation, shortage KPIs with action plans", "Request supplier dashboards"),
                        ]
                    },
                ]
            },
        ]
    },
    {
        "code": "SIM", "label": "Supplier Industrial Management", "weight": 1.0,
        "subdomains": [
            {
                "code": "SIM_PERF", "label": "Supplier Selection & Performance", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are suppliers identified, assessed and approved before qualification?",
                        "guidance": "Check for a cross-functional selection process with weighted criteria and risk assessment.",
                        "criteria": [
                            ("Cross-functional selection process (Purchasing, Quality, Engineering, SC)", "Request supplier qualification procedure"),
                            ("Weighted criteria: quality, capacity, special processes, financial health, ESG", "Check supplier scoring grid"),
                            ("On-site assessments for critical processes", "Request qualification audit reports"),
                            ("ASL maintained with traceable decisions and validity period", "Request approved supplier list"),
                        ]
                    },
                    {
                        "text": "How is supplier performance measured, tracked and reviewed over time?",
                        "guidance": "Check for formalised scorecards, periodic reviews and an escalation process for underperformers.",
                        "criteria": [
                            ("Formalised supplier scorecards used across all commodities", "Request scorecards for top 5 suppliers"),
                            ("KPIs covering at minimum OTD, OQD, NC backlog", "Check KPI definition and calculation frequency"),
                            ("Regular performance reviews (monthly/quarterly) with action tracking", "Request recent supplier review minutes"),
                            ("Structured escalation process, performance integrated into sourcing decisions", "Check the watchlist process"),
                        ]
                    },
                    {
                        "text": "How are suppliers supported and developed to meet performance expectations?",
                        "guidance": "Check for a structured supplier development programme with designated focal points and problem-solving tools.",
                        "criteria": [
                            ("Structured supplier development programme with cross-functional focal points", "Request supplier development organisation"),
                            ("Structured problem solving (8D, RCA, PFMEA update)", "Request recent 8D examples from suppliers"),
                            ("Regular follow-up reviews with KPIs and milestones", "Request active supplier improvement plans"),
                        ]
                    },
                ]
            },
            {
                "code": "SIM_RISK", "label": "Supplier Risk Management", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are supplier risks assessed and their mitigation plans managed?",
                        "guidance": "Check for a risk assessment model covering quality, delivery, financial, capacity and compliance dimensions.",
                        "criteria": [
                            ("Risk assessment model covering quality, delivery, financials, capacity, compliance", "Request supplier risk assessment grid"),
                            ("Critical suppliers clearly identified (single source, high impact)", "Request critical supplier mapping"),
                            ("Risk register maintained and reviewed periodically", "Request supplier risk register"),
                            ("Mitigation plans with deadlines, owners and regular reviews", "Check mitigation plan tracking"),
                        ]
                    },
                ]
            },
        ]
    },
    {
        "code": "IQ", "label": "Industrialization & Quality", "weight": 1.0,
        "subdomains": [
            {
                "code": "IQ_NC", "label": "NC Management & Customer Protection", "weight": 1.2,
                "questions": [
                    {
                        "text": "How are non-conformities detected, recorded, categorised and analysed?",
                        "guidance": "Check for a QMS with a standardised NCR workflow, trend analysis and integration into problem solving.",
                        "criteria": [
                            ("NCs recorded in a standardised QMS with NCR workflow", "Request NC management tool and examples"),
                            ("Standard categorisation (type, source, impact) with traceability", "Check available categories in the tool"),
                            ("Regular trend analysis (Pareto, recurrences) by cross-functional team", "Request NC Pareto analyses for last 3 months"),
                            ("NCs used as input for problem solving", "Check NC → 8D link in the process"),
                        ]
                    },
                    {
                        "text": "How are containment actions identified, deployed and tracked to protect customers?",
                        "guidance": "Check for a standardised containment procedure with activation timelines and traceability of contained lots.",
                        "criteria": [
                            ("Standardised containment procedures", "Request containment procedure and recent examples"),
                            ("Immediate containment with evidence (photos, inspections, segregations)", "Check containment trigger lead times"),
                            ("Systematic customer notification in case of external escape", "Request customer NC communication process"),
                        ]
                    },
                    {
                        "text": "How are root causes identified and corrective actions validated and tracked?",
                        "guidance": "Check for deployment of a standard methodology (8D), team training and effectiveness verification.",
                        "criteria": [
                            ("Standard methodology deployed (8D) with cross-functional teams", "Request last 5 closed 8Ds"),
                            ("Structured training of problem-solving leaders", "Request 8D training plan"),
                            ("Root cause validation required (IS/IS NOT, tests, evidence)", "Check IS/IS NOT analysis quality in 8Ds"),
                            ("Corrective and preventive actions tracked with due dates", "Request on-time closure rate"),
                        ]
                    },
                ]
            },
            {
                "code": "IQ_CHANGE", "label": "Industrial Change Management", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are industrial changes assessed, approved, executed and validated?",
                        "guidance": "Check for a formalised change management process covering process, engineering and supplier changes.",
                        "criteria": [
                            ("Change management workflow with multi-criteria impact assessment (quality, cost, logistics, capacity)", "Request change management procedure"),
                            ("MFT team systematically constituted (manufacturing, engineering, SC)", "Check change team composition"),
                            ("Systematic FAIs, documented, with post-FAI tracking through ramp-up", "Request recent FAI reports"),
                        ]
                    },
                ]
            },
            {
                "code": "IQ_PRES", "label": "Product Preservation & FOD", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are product preservation and FOD prevention planned, executed and audited?",
                        "guidance": "Check for documented handling/packaging/storage rules and a formalised FOD programme.",
                        "criteria": [
                            ("Documented handling, packaging, storage rules (hazmat, shelf-life, temperature-controlled)", "Request preservation procedures"),
                            ("FOD programme defined: zoning, tool control, part accountability", "Request FOD programme and audit results"),
                            ("Environmental controls (ESD, humidity) monitored with evidence", "Check storage condition records"),
                            ("Regular layered audits, NCs triggering corrective actions", "Request preservation/FOD audit plan"),
                        ]
                    },
                ]
            },
        ]
    },
    {
        "code": "ME", "label": "Manufacturing Excellence", "weight": 1.0,
        "subdomains": [
            {
                "code": "ME_FLOW", "label": "Physical Flow & Layout", "weight": 1.0,
                "questions": [
                    {
                        "text": "How is the shop floor layout organised to optimise physical product flows?",
                        "guidance": "Check the application of layout standards, pedestrian/material separation and visual management performance.",
                        "criteria": [
                            ("Layout standards applied across the entire shop floor", "Observe the floor and request layout standards"),
                            ("Continuous product flow with pedestrian/material separation", "Check the layout plan and routes"),
                            ("Strong and consistent visual management across the shop floor", "Observe displays and floor panels"),
                        ]
                    },
                    {
                        "text": "How are lead times and bottlenecks measured, controlled and reduced?",
                        "guidance": "Check for a lead time baseline by family and structured bottleneck management.",
                        "criteria": [
                            ("Standard lead time baseline (order-to-ship + internal lead times) by family/SKU", "Request lead time baseline and update date"),
                            ("Regular VSMs and process time studies (CT/TT/C/O, yields); WIP limits by workstation", "Request recent VSMs and time studies"),
                            ("Improvement plans tracked with quantified LT reductions", "Request lead time reduction plans"),
                        ]
                    },
                ]
            },
            {
                "code": "ME_STD", "label": "Standards & Work Instructions", "weight": 1.0,
                "questions": [
                    {
                        "text": "What is the deployment level of 5S and HSE on production lines?",
                        "guidance": "Check that 5S and HSE are fully integrated into daily operations with a proactive improvement culture.",
                        "criteria": [
                            ("5S standards deployed and regularly audited across all workstations", "Request 5S scores by area and audit plan"),
                            ("HSE risks identified, assessed and mitigated with regular reviews", "Request the single document and HSE reviews"),
                            ("Strong safety culture with zero tolerance for deviations", "Check accident rate indicators and floor reactions"),
                        ]
                    },
                    {
                        "text": "Are standardised work instructions systematically written and available to operators?",
                        "guidance": "Check that work instructions cover all workstations, include quality/safety requirements and are kept up to date.",
                        "criteria": [
                            ("Work instructions defined, approved and available at point of use for all operations", "Request workstation coverage by work instructions"),
                            ("Instructions include key steps, safety requirements, quality controls and acceptance criteria", "Check content of 3-5 random work instructions"),
                            ("Compliance monitored and updates managed through a formal change process", "Check work instruction update process"),
                        ]
                    },
                    {
                        "text": "How is workforce flexibility managed to ensure operational continuity?",
                        "guidance": "Check for up-to-date skills and flexibility matrices, integrated into production planning.",
                        "criteria": [
                            ("Skills and flexibility matrices defined and maintained for key processes and products", "Request flexibility matrices by line"),
                            ("Multi-skilling planned to ensure operational continuity", "Check versatility rate by sector"),
                            ("Training plans integrated into production planning and anticipating risks", "Request annual training plan and its link to production plan"),
                        ]
                    },
                ]
            },
            {
                "code": "ME_KPI", "label": "KPI & Performance Management", "weight": 1.2,
                "questions": [
                    {
                        "text": "Are SQCDP rituals deployed and executed in a disciplined manner?",
                        "guidance": "Check regularity, quality and resilience of SQCDP rituals at all levels of the organisation.",
                        "criteria": [
                            ("SQCDP rituals planned and executed in a disciplined manner, resilient to absences", "Observe a floor ritual and check minutes"),
                            ("Indicators updated daily and used for fact-based decisions", "Check quality of displayed data"),
                            ("Problems solved at the right level with disciplined action tracking", "Request action closure rates for the last 4 weeks"),
                        ]
                    },
                    {
                        "text": "Is the production rate driven and aligned in real time with the Master Production Schedule?",
                        "guidance": "Check MPS/production alignment and real-time visibility on progress vs plan.",
                        "criteria": [
                            ("Production requirements clearly defined and visible in real time", "Check progress displays by line"),
                            ("Current status displayed and regularly updated, deviations corrected proactively", "Request update frequency and correction mechanisms"),
                            ("Production rate fully aligned with MPS, visibility and proactive adjustments", "Check MPS/production plan/actual progress consistency"),
                        ]
                    },
                    {
                        "text": "How are production disruptions signalled and addressed (Andon system)?",
                        "guidance": "Check for an operational Andon system with defined and measured response times.",
                        "criteria": [
                            ("Disruption signalling system in place (Andon or equivalent)", "Observe the floor device and its actual use"),
                            ("Support teams respond within defined timeframes, effectiveness measured periodically", "Request Andon response time KPIs"),
                        ]
                    },
                    {
                        "text": "Is QRQC (Quick Response Quality Control) deployed and effective at line level?",
                        "guidance": "Check QRQC deployment at line level with regular meetings and rapid problem resolution.",
                        "criteria": [
                            ("QRQC deployed at line level with regular meetings and rapid problem detection", "Observe a QRQC meeting and request minutes"),
                            ("Corrective actions implemented within defined timeframes", "Request QRQC on-time compliance rate"),
                        ]
                    },
                ]
            },
            {
                "code": "ME_EQP", "label": "Equipment Management & TPM", "weight": 1.0,
                "questions": [
                    {
                        "text": "How are equipment and measuring instruments identified and monitored?",
                        "guidance": "Check that all equipment and instruments are identified, calibrated and tracked according to a defined plan.",
                        "criteria": [
                            ("Equipment and instruments identified and calibrated according to a defined schedule", "Request calibration plan and compliance rate"),
                            ("Monitoring process partially automated and traceable", "Check calibration tracking tools"),
                        ]
                    },
                    {
                        "text": "How is the TPM strategy deployed to optimise equipment performance?",
                        "guidance": "Check TPM pillar deployment, OEE measurement and its use to drive improvement actions.",
                        "criteria": [
                            ("TPM strategy deployed on key equipment (autonomous and planned maintenance)", "Request maintenance plans and TPM sheets"),
                            ("OEE measured regularly and used to improve availability and performance", "Request OEE data for last 3 months"),
                            ("Industrial policy aligned with strategy (make/buy, capacity, technology)", "Request 3-year industrial roadmap"),
                            ("Asset criticality, MTBF/MTTR tracked, spare parts optimised", "Request equipment criticality analysis and spare parts inventory"),
                        ]
                    },
                ]
            },
        ]
    },
]

# ─── Seed ─────────────────────────────────────────────────────────────────────

def seed(reset: bool = False, dry_run: bool = False):
    Base.metadata.create_all(engine)

    if dry_run:
        total_q = sum(
            len(q['criteria'])
            for d in FRAMEWORK
            for sd in d['subdomains']
            for q in sd['questions']
        )
        print(f"[DRY-RUN] JIP Framework: {len(FRAMEWORK)} domains · "
              f"{sum(len(d['subdomains']) for d in FRAMEWORK)} subdomains · "
              f"{sum(len(sd['questions']) for d in FRAMEWORK for sd in d['subdomains'])} questions · "
              f"{total_q} criteria")
        return

    with Session(engine) as session:
        existing = session.query(Domain).count()
        if existing > 0 and not reset:
            print("[INFO] A framework already exists — use --reset to replace it")
            return

        if reset:
            session.query(Criterion).delete()
            session.query(Question).delete()
            session.query(Subdomain).delete()
            session.query(Domain).delete()
            session.commit()
            print("[INFO] Existing framework deleted")

        for d_idx, d_data in enumerate(FRAMEWORK):
            d = Domain(
                code=d_data["code"],
                label=d_data["label"],
                weight=d_data.get("weight", 1.0),
                order_index=d_idx,
            )
            session.add(d)
            session.flush()

            for sd_idx, sd_data in enumerate(d_data["subdomains"]):
                sd = Subdomain(
                    domain_id=d.id,
                    code=sd_data["code"],
                    label=sd_data["label"],
                    weight=sd_data.get("weight", 1.0),
                    order_index=sd_idx,
                )
                session.add(sd)
                session.flush()

                for q_idx, q_data in enumerate(sd_data["questions"]):
                    q = Question(
                        subdomain_id=sd.id,
                        text=q_data["text"],
                        guidance=q_data.get("guidance", ""),
                        order_index=q_idx + 1,
                    )
                    session.add(q)
                    session.flush()

                    for c_idx, criterion in enumerate(q_data["criteria"]):
                        text, hint = criterion[0], criterion[1] if len(criterion) > 1 else ""
                        reco = criterion[2] if len(criterion) > 2 else ""
                        session.add(Criterion(
                            question_id=q.id,
                            text=text,
                            verification_hint=hint,
                            weight=1.0,
                            order_index=c_idx + 1,
                            effort_default="moyen",
                            impact_default="moyen",
                            recommendation_label=reco,
                        ))

        session.commit()

    total_q = sum(len(sd['questions']) for d in FRAMEWORK for sd in d['subdomains'])
    total_c = sum(len(q['criteria']) for d in FRAMEWORK for sd in d['subdomains'] for q in sd['questions'])
    print(f"[OK] JIP Framework loaded: {len(FRAMEWORK)} domains · "
          f"{sum(len(d['subdomains']) for d in FRAMEWORK)} subdomains · "
          f"{total_q} questions · {total_c} criteria")


if __name__ == "__main__":
    reset   = "--reset"   in sys.argv
    dry_run = "--dry-run" in sys.argv
    seed(reset=reset, dry_run=dry_run)
