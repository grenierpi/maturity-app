# Maturity App — MVP

Application d'évaluation de maturité fournisseur (framework JIP Capgemini).

---

## Démarrage rapide

```bash
chmod +x start.sh
./start.sh           # Premier lancement — installe tout et démarre
./start.sh           # Relances suivantes — démarre directement
./start.sh --reset   # Repart de zéro (DB effacée, données rechargées)
```

**Avant le premier lancement**, copiez `.env.example` en `.env` et renseignez votre clé :
```bash
cp backend/.env.example backend/.env
# Éditer backend/.env → ANTHROPIC_API_KEY=sk-ant-...
```

URLs :
- App : http://localhost:5173
- API docs : http://localhost:8000/docs
- Logs BE : `tail -f backend.log`
- Logs FE : `tail -f frontend.log`

---

## Structure

```
maturity-app/
│
├── start.sh                        ← Script de démarrage / réinstall
│
├── backend/
│   ├── main.py                     ← Point d'entrée FastAPI
│   ├── database.py                 ← Config SQLAlchemy, migration auto
│   ├── models.py                   ← Tous les modèles SQLAlchemy (12 tables)
│   ├── scoring.py                  ← Moteur de calcul des scores de maturité
│   ├── generation.py               ← Génération chantiers via Claude API
│   ├── pdf_export.py               ← Export PDF (pdfkit / wkhtmltopdf)
│   ├── fake_data.py                ← Données de test (fournisseurs + campagnes)
│   ├── seed_jip_framework.py       ← Seed du framework JIP (5 domaines, 17 SD, 33 questions)
│   ├── seed_jip_templates.py       ← Seed des 30 chantiers JIP
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── routers/
│   │   ├── framework.py            ← GET framework (lecture)
│   │   ├── framework_admin.py      ← CRUD framework (admin)
│   │   ├── campaigns.py            ← Fournisseurs, campagnes, progression
│   │   ├── interview.py            ← Saisie des réponses, pièces jointes
│   │   ├── assessment.py           ← Points faibles, templates par SD, cibles
│   │   ├── synthesis.py            ← Scores, radar, export PDF
│   │   ├── templates.py            ← Catalogue de chantiers (CRUD)
│   │   ├── plan.py                 ← Plan de transformation par campagne
│   │   └── __init__.py
│   │
│   └── templates/
│       └── report.html             ← Template PDF Jinja2
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    │
    └── src/
        ├── main.jsx                ← Point d'entrée React
        ├── App.jsx                 ← Routing
        ├── index.css               ← Tokens Tailwind (@theme)
        │
        ├── api/
        │   └── client.js           ← Tous les appels API centralisés
        │
        ├── components/
        │   ├── Layout.jsx          ← Nav + wrapper
        │   └── ui.jsx              ← Composants partagés (Badge, Button, Card…)
        │
        └── pages/
            ├── CampaignList.jsx    ← Liste des campagnes
            ├── CampaignNew.jsx     ← Création campagne
            ├── CampaignDetail.jsx  ← Détail + progression
            ├── Interview.jsx       ← Conduite de l'interview
            ├── Synthesis.jsx       ← [1] Synthèse assessment
            ├── PlanSelection.jsx   ← [2] Sélection des chantiers
            ├── PlanQualification.jsx ← [3] Qualification effort/impact
            ├── Roadmap.jsx         ← [4] Roadmap finale
            └── admin/
                ├── FrameworkAdmin.jsx  ← Édition du framework
                ├── TemplateList.jsx    ← Catalogue chantiers
                └── TemplateEdit.jsx    ← Édition d'un chantier

```

---

## Flux utilisateur

```
[Interview] → [Synthèse] → [Sélection chantiers] → [Qualification] → [Roadmap]
```

| Page | Route | Description |
|------|-------|-------------|
| Interview | `/campaigns/:id/interview` | Saisie des scores critère par critère |
| Synthèse | `/campaigns/:id/synthesis` | Radar + points faibles par sous-domaine |
| Sélection | `/campaigns/:id/plan-selection` | Chantiers par SD + cibles CDP + spider to-be |
| Qualification | `/campaigns/:id/plan` | Effort/impact + rewording client |
| Roadmap | `/campaigns/:id/roadmap` | Restitution finale + export PDF |

---

## Administration

| Page | Route | Description |
|------|-------|-------------|
| Framework | `/admin/framework` | Édition domaines / SD / questions / critères |
| Catalogue | `/admin/templates` | Chantiers réutilisables multi-campagnes |

---

## Variables d'environnement (`backend/.env`)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic | — |
| `DATABASE_URL` | URL SQLite | `sqlite:///./maturity.db` |
| `UPLOAD_DIR` | Dossier pièces jointes | `./uploads` |
| `ENV` | `development` ou `production` | `production` |

---

## Prérequis système

- Python 3.9+
- Node.js 18+
- Homebrew (macOS) pour WeasyPrint/pdfkit

**Export PDF :**
```bash
brew install wkhtmltopdf
pip install pdfkit
```
