#!/bin/bash
# start.sh — Install + démarrage de Maturity App
# Usage :
#   ./start.sh          → install si nécessaire, puis démarre
#   ./start.sh --reset  → recrée la DB et recharge les données

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
RESET=false

[[ "$1" == "--reset" ]] && RESET=true

# ── Couleurs ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
err()  { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo "  ███╗   ███╗ █████╗ ████████╗██╗   ██╗██████╗ ██╗████████╗██╗   ██╗"
echo "  ████╗ ████║██╔══██╗╚══██╔══╝██║   ██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝"
echo "  ██╔████╔██║███████║   ██║   ██║   ██║██████╔╝██║   ██║    ╚████╔╝ "
echo "  ██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║     ╚██╔╝  "
echo "  ██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║██║   ██║      ██║   "
echo "  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝  "
echo "                        Maturity App — start.sh"
echo ""

# ── Prérequis ─────────────────────────────────────────────────────────────────
info "Vérification des prérequis..."
command -v python3 >/dev/null || err "Python3 non trouvé"
command -v node    >/dev/null || err "Node.js non trouvé"
command -v npm     >/dev/null || err "npm non trouvé"

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
NODE_VERSION=$(node --version | tr -d 'v' | cut -d. -f1)
ok "Python $PYTHON_VERSION · Node $(node --version)"

# ── .env ──────────────────────────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  info "Création du fichier .env depuis .env.example..."
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo ""
  echo -e "${RED}  ⚠️  IMPORTANT : renseignez votre ANTHROPIC_API_KEY dans backend/.env${NC}"
  echo "     Éditez le fichier puis relancez ./start.sh"
  echo ""
  exit 0
fi

# Vérifier que la clé est renseignée
if grep -q "your-key-here" "$BACKEND/.env"; then
  echo ""
  echo -e "${RED}  ⚠️  ANTHROPIC_API_KEY non configurée dans backend/.env${NC}"
  echo "     Remplacez 'sk-ant-your-key-here' par votre vraie clé"
  echo "     puis relancez ./start.sh"
  echo ""
  exit 0
fi
ok ".env configuré"

# ── Backend — venv ─────────────────────────────────────────────────────────────
cd "$BACKEND"

if [ ! -d "venv" ]; then
  info "Création du venv Python..."
  python3 -m venv venv
  ok "venv créé"
fi

# Activation venv — compatible macOS (bash, zsh, fish)
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
elif [ -f "venv/bin/activate.fish" ]; then
  source venv/bin/activate.fish
else
  err "Impossible d'activer le venv — fichier activate introuvable"
fi

# Installer/mettre à jour les dépendances si requirements.txt plus récent que venv
if [ ! -f "venv/.installed" ] || [ "requirements.txt" -nt "venv/.installed" ]; then
  info "Installation des dépendances Python..."
  pip install -q --upgrade pip
  pip install -q -r requirements.txt
  touch venv/.installed
  ok "Dépendances Python installées"
else
  ok "Dépendances Python à jour"
fi

# Export PDF — wkhtmltopdf (macOS)
if ! command -v wkhtmltopdf >/dev/null 2>&1; then
  info "wkhtmltopdf non trouvé — installation via Homebrew..."
  if command -v brew >/dev/null 2>&1; then
    brew install wkhtmltopdf --quiet
    ok "wkhtmltopdf installé"
  else
    echo -e "${YELLOW}  ⚠ wkhtmltopdf non installé — export PDF indisponible${NC}"
    echo "    Installez-le manuellement : brew install wkhtmltopdf"
  fi
else
  ok "wkhtmltopdf disponible"
fi

# pdfkit dans le venv
if ! python3 -c "import pdfkit" 2>/dev/null; then
  info "Installation de pdfkit..."
  pip install -q pdfkit
  ok "pdfkit installé"
fi

# ── Base de données ────────────────────────────────────────────────────────────
DB_FILE="$BACKEND/maturity.db"

if [ "$RESET" = true ]; then
  info "Reset de la base de données..."
  rm -f "$DB_FILE"
  ok "DB supprimée"
fi

if [ ! -f "$DB_FILE" ]; then
  info "Initialisation de la base de données..."
  python3 -c "
import sys; sys.path.insert(0,'.')
from database import Base, engine, init_upload_dir
Base.metadata.create_all(engine)
init_upload_dir()
print('Tables créées')
"
  ok "Base de données initialisée"

  info "Chargement des données de test..."
  info "Chargement du framework JIP..."
  python3 seed_jip_framework.py
  ok "Framework JIP chargé"

  info "Chargement des données de test..."
  python3 fake_data.py --skip-framework
  ok "Données de test chargées (3 fournisseurs)"

  info "Chargement du catalogue de chantiers JIP..."
  python3 seed_jip_templates.py
  ok "30 chantiers JIP chargés dans le catalogue"

elif [ "$RESET" = false ]; then
  ok "Base de données existante conservée"
fi

# ── Frontend — node_modules ────────────────────────────────────────────────────
cd "$FRONTEND"

if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
  info "Installation des dépendances npm..."
  npm install --silent
  ok "Dépendances npm installées"
else
  ok "Dépendances npm à jour"
fi

# ── Tuer les processus existants sur les ports 8000 et 5173 ───────────────────
cd "$ROOT"
info "Nettoyage des ports 8000 et 5173..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1
ok "Ports libérés"

# ── Démarrage ─────────────────────────────────────────────────────────────────
echo ""
echo "  ─────────────────────────────────────────────────────"
echo "   Démarrage des serveurs..."
echo "  ─────────────────────────────────────────────────────"
echo ""

# Backend en arrière-plan avec logs dans un fichier
cd "$BACKEND"
source venv/bin/activate 2>/dev/null || source venv/bin/activate.fish 2>/dev/null
uvicorn main:app --reload --port 8000 --log-level warning > "$ROOT/backend.log" 2>&1 &
BE_PID=$!
echo "  Backend PID : $BE_PID  (logs → backend.log)"

# Attendre que le backend soit prêt
info "Attente du backend..."
for i in {1..15}; do
  if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    ok "Backend prêt sur http://localhost:8000"
    break
  fi
  sleep 1
  if [ $i -eq 15 ]; then
    err "Backend non démarré après 15s — vérifiez backend.log"
  fi
done

# Frontend en arrière-plan
cd "$FRONTEND"
npm run dev -- --port 5173 > "$ROOT/frontend.log" 2>&1 &
FE_PID=$!
echo "  Frontend PID : $FE_PID  (logs → frontend.log)"

# Attendre que le frontend soit prêt
info "Attente du frontend..."
for i in {1..20}; do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    ok "Frontend prêt sur http://localhost:5173"
    break
  fi
  sleep 1
  if [ $i -eq 20 ]; then
    err "Frontend non démarré après 20s — vérifiez frontend.log"
  fi
done

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo "  ─────────────────────────────────────────────────────"
echo -e "  ${GREEN}✓ Maturity App démarrée${NC}"
echo "  ─────────────────────────────────────────────────────"
echo ""
echo "   App       →  http://localhost:5173"
echo "   API docs  →  http://localhost:8000/docs"
echo ""
echo "   Logs BE   →  tail -f backend.log"
echo "   Logs FE   →  tail -f frontend.log"
echo ""
echo "   Arrêter   →  kill $BE_PID $FE_PID"
echo "               (ou Ctrl+C si lancé en foreground)"
echo ""
echo "   Options   →  ./start.sh --reset  (recrée la DB)"
echo "  ─────────────────────────────────────────────────────"
echo ""

# Garder le script en vie pour capturer Ctrl+C
trap "echo ''; info 'Arrêt...'; kill $BE_PID $FE_PID 2>/dev/null; ok 'Serveurs arrêtés'; exit 0" INT TERM
wait