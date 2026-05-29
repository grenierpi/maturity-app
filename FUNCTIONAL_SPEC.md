# Maturity App — Description fonctionnelle

Document de référence pour la refonte design.

---

## 1. Contexte & objectif

Application web d'évaluation de maturité fournisseur basée sur le framework JIP Capgemini.
Elle permet à un consultant de conduire un audit structuré avec un fournisseur, d'identifier les axes d'amélioration prioritaires, et de produire un plan de transformation chantier par chantier, jusqu'à la roadmap finale.

**Utilisateurs cibles :** consultants Capgemini (usage desktop uniquement).

---

## 2. Stack technique

| Couche | Tech |
|--------|------|
| Frontend | React 18 + Vite + TailwindCSS v4 |
| Backend | FastAPI (Python) + SQLite |
| IA | Claude API (Anthropic) — génération de chantiers et fiches |
| PDF | pdfkit + wkhtmltopdf |
| Charts | Recharts (radar/spider) |

---

## 3. Structure de navigation

```
/ (redirect)
└── /campaigns                          Liste des campagnes
    └── /campaigns/new                  Création campagne
    └── /campaigns/:id                  Détail campagne
        └── /interview/:questionId      [1] Interview
        └── /synthesis                  [2] Synthèse
        └── /plan-selection             [3] Sélection chantiers
        └── /plan                       [4] Qualification
        └── /roadmap                    [5] Roadmap
        └── /gantt                      [6] Planning (Gantt)
        └── /sheets                     [7] Fiches chantier

/admin/framework                        Admin — framework JIP
/admin/templates                        Admin — catalogue chantiers
/admin/templates/:id                    Admin — édition chantier
```

Navigation principale (Layout) : **Campagnes · Catalogue chantiers · Framework**

Workflow interne à une campagne : barre de progression horizontale en haut de page avec les 7 étapes. Les étapes suivantes sont verrouillées tant que la précédente n'est pas complétée.

---

## 4. Modèle de données (résumé)

### Framework (référentiel, seeder)
- **Domain** (5) : ORG, PLAN, SIM, IQ, ME — chaque domaine a une couleur distincte
- **Subdomain** (17) : sous-domaines par domaine
- **Question** (33) : questions par sous-domaine, avec priorité P0/P1/P2
- **Criterion** : critères binaires par question (effort/impact par défaut, label recommandation)

### Opérationnel
- **Supplier** : fournisseur audité (nom, secteur)
- **Campaign** : instance d'audit (titre, consultant, statut, domaines sélectionnés, notes synthèse)
- **CriterionResponse** : réponse par critère (score 0-4, commentaire, flag "à revoir", pièce jointe)
- **SubdomainScore** : score calculé par sous-domaine + cible CDP définie par le consultant
- **TransformationItem** : chantier sélectionné pour la campagne (effort, impact, phase, planning)
- **ProjectTemplate** : chantier du catalogue (réutilisable multi-campagnes)
- **ProjectTemplateSheet** : fiche détaillée d'un chantier (objectifs, actions, acteurs, KPIs…)

### Scoring
- Score par critère : 0 à 4
- Buckets : **Critique** (< 1) · **Faible** (1–2) · **Moyen** (2–3) · **Bon** (≥ 3)
- Score sous-domaine = moyenne pondérée des critères
- Score domaine = moyenne pondérée des sous-domaines
- Score global = moyenne pondérée des domaines

---

## 5. Pages — description fonctionnelle

---

### 5.1 Liste des campagnes `/campaigns`

**Rôle :** point d'entrée de l'application.

**Contenu :**
- En-tête : titre + bouton "Nouvelle campagne"
- Liste de cards cliquables, une par campagne
- Chaque card : titre de la campagne, nom du fournisseur, consultant, date, badge statut (Brouillon / En cours / Terminée / Archivée), progression en % (ex: 72% · 24/33)
- État vide : placeholder illustré avec CTA

**Actions :** cliquer sur une card → Détail campagne

---

### 5.2 Création campagne `/campaigns/new`

**Rôle :** créer une nouvelle campagne d'audit.

**Formulaire :**
- **Fournisseur** : toggle "Existant" / "Nouveau"
  - Existant : dropdown de sélection
  - Nouveau : champ texte nom + champ secteur (optionnel)
- **Titre de la campagne** : texte libre (ex: "Audit maturité mai 2026")
- **Consultant** : texte libre optionnel
- **Domaines à auditer** : checkboxes multi-sélection des 5 domaines JIP (au moins 1 requis)

**Action :** "Créer et démarrer" → redirige vers l'interview

---

### 5.3 Détail campagne `/campaigns/:id`

**Rôle :** tableau de bord d'une campagne.

**Contenu :**
- En-tête : titre, fournisseur, statut, boutons "Continuer l'interview" et "Synthèse"
- Progression globale en %
- Progression par domaine (barres)
- Nombre de critères flaggés "à revoir"
- Domaines dans le périmètre de l'audit

---

### 5.4 Interview `/campaigns/:id/interview/:questionId`

**Rôle :** saisie des réponses critère par critère pendant l'entretien avec le fournisseur.

**Layout :** deux colonnes
- **Colonne gauche — navigation** :
  - Liste des questions groupées par domaine (accordéon)
  - Chaque domaine : couleur distincte, compteur (ex: 3/7)
  - Chaque question : indicateur de complétion (% des critères répondus), badge score
  - Scroll automatique sur la question active
  - Domaines complétés repliés automatiquement

- **Colonne droite — saisie** :
  - Texte de la question + guidance
  - Pour chaque critère :
    - Texte du critère
    - Score : boutons 0 / 1 / 2 / 3 / 4 (sélection unique, couleur selon valeur)
    - Hint de vérification (texte d'aide)
    - Bouton "À revoir" (flag)
    - Zone commentaire (autosave debounced 800ms)
    - Bouton pièce jointe
  - Sauvegarde automatique — feedback "✓ Sauvegardé" 2s
  - Navigation : ← Précédent / Suivant →
  - Bouton "Voir la synthèse →" en bas

**Comportement clé :** auto-navigate vers la première question non complétée au chargement.

---

### 5.5 Synthèse `/campaigns/:id/synthesis`

**Rôle :** visualisation des résultats de l'assessment + identification des points faibles.

**Contenu :**

**Stats en haut :**
- Complétion (%), critères évalués, domaines audités, critères flaggés

**Spider global (domaines) :**
- Radar chart Recharts, 1 axe par domaine audité
- Valeurs As-Is (gris) + To-Be optionnel (violet)

**Spider détaillé (sous-domaines) :**
- Radar chart par domaine, couleur par domaine
- Même logique As-Is / To-Be

**Heatmap par domaine :**
- Tableau : lignes = sous-domaines, colonnes = questions
- Cellule colorée selon le bucket du score (critique/faible/moyen/bon)

**Points faibles par sous-domaine :**
- Pour chaque sous-domaine : les 2 critères les plus faibles (score ≤ 2) + critères flaggés
- Badge score + badge bucket

**Notes consultant :**
- Zone texte libre, autosave 1s

**Action :** "Valider la synthèse et passer aux chantiers →"

---

### 5.6 Sélection des chantiers `/campaigns/:id/plan-selection`

**Rôle :** définir les cibles de maturité par sous-domaine et sélectionner les chantiers à inclure dans le plan.

**Layout :** deux colonnes
- **Colonne gauche — liste sous-domaines** :
  - Chaque sous-domaine : label, score actuel (coloré), cible CDP (étoile cliquable 1-4)
  - Spider As-Is vs To-Be en temps réel (mise à jour dynamique quand on change les cibles)
  - Delta par domaine

- **Colonne droite — chantiers** :
  - Quand un sous-domaine est sélectionné : liste des chantiers du catalogue compatibles
  - Chaque chantier : label, description, effort/impact badges, score maturité minimum requis (warning si score actuel insuffisant)
  - Checkbox sélection
  - Bouton "+ Manuel" : modal de création d'un chantier ad-hoc

**Modal création chantier :**
- Label, description, effort, impact, sous-domaine principal, cible maturité espérée

**Action :** "Valider et qualifier →"

---

### 5.7 Qualification `/campaigns/:id/plan`

**Rôle :** ajuster effort/impact de chaque chantier sélectionné et reformuler pour le client.

**Layout :** liste de cards, une par chantier

**Chaque card :**
- Label original
- Toggles effort (Faible / Moyen / Fort) et impact (Faible / Moyen / Fort)
- Bouton "Reformuler" → ouvre inline editor :
  - Champ "Intitulé client" (texte court)
  - Champ "Description client" (texte long)
  - Bouton "✦ Générer par IA" → appel Claude API avec le contexte du sous-domaine
  - Bouton "Appliquer"

**Matrice effort/impact :**
- Visualisation en 2x2 des chantiers positionnés (Quick wins / Chantiers majeurs / Petits gains / Low priority)

**Chantiers exclus :** section repliable avec bouton "restaurer"

**Action :** "Roadmap →"

---

### 5.8 Roadmap `/campaigns/:id/roadmap`

**Rôle :** vue de restitution finale du plan de transformation.

**Contenu :**
- Stats : nombre de chantiers, budget effort, impact global
- Spider As-Is vs To-Be final
- Matrice effort/impact
- Chantiers groupés par phase (Quick wins · Court terme · Moyen terme · Long terme)
- Chaque chantier : label client, description client, sous-domaine, effort/impact badges, phase
- Bouton "Export PDF" → génère le rapport PDF complet

---

### 5.9 Planning (Gantt) `/campaigns/:id/gantt`

**Rôle :** planifier les chantiers dans le temps (mois de début + durée).

**Layout :**
- Tableau : lignes = chantiers, colonnes = mois (M1 à M24)
- Chaque chantier : barre colorée selon la phase, positionnée et dimensionnée
- Survol d'une barre → popover inline : sélecteur mois de début + durée
- Bouton "Effacer" pour reset le planning d'un chantier

**Actions :** "Valider et rédiger les fiches →" ou "Fiches →"

---

### 5.10 Fiches chantier `/campaigns/:id/sheets`

**Rôle :** rédiger les fiches détaillées de chaque chantier pour livrable client.

**Layout :** navigation par chantier (liste à gauche) + fiche à droite

**Chaque fiche :**
- En-tête : label client, phase badge, domaine, durée indicative
- Sections éditables :
  - Objectifs (texte libre)
  - Actions clés (liste avec ajout/suppression)
  - Acteurs à mobiliser (liste)
  - Prérequis (texte)
  - Livrables attendus (liste)
  - KPIs de succès (liste)
- Bouton "✦ Générer par IA" (par fiche) → Claude remplit tous les champs
- Bouton "✦ Générer les N fiches vides" → génère toutes d'un coup
- Autosave + feedback visuel

**Exports disponibles :**
- Fiches PDF
- Export complet (Gantt + Fiches)
- Plan d'actions XLS

---

## 6. Pages admin

### 6.1 Framework `/admin/framework`

Édition complète du référentiel JIP :
- CRUD domaines (label, poids, ordre)
- CRUD sous-domaines par domaine
- CRUD questions par sous-domaine (texte, guidance, priorité P0/P1/P2)
- CRUD critères par question (texte, hint de vérification, poids, effort/impact par défaut, label recommandation)

### 6.2 Catalogue chantiers `/admin/templates`

Liste de tous les chantiers réutilisables avec filtrage par domaine.

### 6.3 Édition chantier `/admin/templates/:id`

Édition d'un chantier du catalogue :
- Label, description, effort/impact par défaut, sous-domaine principal, maturité minimum requise
- Fiche complète (objectifs, actions, acteurs, prérequis, livrables, KPIs)

---

## 7. Design tokens

### Couleurs principales
| Token | Hex | Usage |
|-------|-----|-------|
| primary-500 | #7F77DD | Violet — couleur principale, CTAs, liens |
| primary-700 | #3C3489 | Violet foncé — texte primaire sur fond clair |
| success-500 | #1D9E75 | Vert — score bon, domaine PLAN |
| warning-500 | #BA7517 | Orange — score faible, domaine SIM |
| danger-500  | #E24B4A | Rouge — score critique, domaine IQ |
| info-500    | #378ADD | Bleu — score moyen, domaine ME |
| neutral-900 | #2C2C2A | Texte principal |
| neutral-500 | #888780 | Texte secondaire |
| neutral-100 | #F1EFE8 | Fond cards |
| neutral-50  | #F5F4F0 | Fond page |

### Couleurs par domaine
| Domaine | Couleur | Hex |
|---------|---------|-----|
| ORG | Violet | #7F77DD |
| PLAN | Vert | #1D9E75 |
| SIM | Orange | #BA7517 |
| IQ | Rouge | #E24B4A |
| ME | Bleu | #378ADD |

### Score buckets
| Bucket | Fond | Texte |
|--------|------|-------|
| Critique (< 1) | #FCEBEB | #791F1F |
| Faible (1–2) | #FAEEDA | #633806 |
| Moyen (2–3) | #E6F1FB | #0C447C |
| Bon (≥ 3) | #E1F5EE | #085041 |

### Typographie & spacing
- Font : system-ui / -apple-system
- Body text : 13–14px
- Titres sections : 15px medium
- Radius : sm 4px · md 6px · lg 10px · xl 12px
- Fond page : #F5F4F0 (warm off-white)
- Cards : fond blanc, border neutral-200, radius xl

---

## 8. Composants UI existants

`Badge` · `Button` (primary / secondary / ghost) · `Card` · `ProgressBar` · `ScoreButton` (0–4) · `ScoreBucketBadge` · `StatBox` · `SectionTitle` · `WorkflowNav`

---

## 9. Intégration Claude API

Deux points d'appel :
1. **Génération de chantiers** (`/campaigns/:id/plan`) : Claude propose des chantiers selon le contexte du sous-domaine et les points faibles détectés
2. **Rédaction de fiches** (`/campaigns/:id/sheets`) : Claude remplit les champs d'une fiche (objectifs, actions, acteurs, KPIs) selon le contexte du chantier et du fournisseur

---

## 10. Flux utilisateur complet

```
Accueil (liste campagnes)
  → Créer campagne (fournisseur + domaines)
    → [1] Interview (saisie critère par critère)
      → [2] Synthèse (radar + points faibles)
        → [3] Sélection chantiers (cibles + catalogue)
          → [4] Qualification (effort/impact + reformulation)
            → [5] Roadmap (vue finale + PDF)
              → [6] Planning Gantt (calendrier)
                → [7] Fiches chantier (livrables détaillés)
```

Chaque étape déverrouille la suivante. Retour en arrière toujours possible.
