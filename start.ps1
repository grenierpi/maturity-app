# start.ps1 — Install + démarrage de Maturity App (Windows)
# Usage :
#   .\start.ps1          → install si nécessaire, puis démarre
#   .\start.ps1 --reset  → recrée la DB et recharge les données
#
# Prérequis Windows : Python 3.9+, Node.js 18+, npm
# Exécuter en tant qu'admin si l'ExecutionPolicy bloque le script :
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

param(
    [switch]$reset
)

$ErrorActionPreference = "Stop"

$ROOT    = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$SCRIPTS = Join-Path $BACKEND "scripts"
$FRONTEND = Join-Path $ROOT "frontend"

# ── Couleurs ──────────────────────────────────────────────────────────────────
function ok   { param($msg) Write-Host "OK  $msg" -ForegroundColor Green }
function info { param($msg) Write-Host "->  $msg" -ForegroundColor Yellow }
function err  { param($msg) Write-Host "X   $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  ███╗   ███╗ █████╗ ████████╗██╗   ██╗██████╗ ██╗████████╗██╗   ██╗" -ForegroundColor Cyan
Write-Host "  ████╗ ████║██╔══██╗╚══██╔══╝██║   ██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝" -ForegroundColor Cyan
Write-Host "  ██╔████╔██║███████║   ██║   ██║   ██║██████╔╝██║   ██║    ╚████╔╝ " -ForegroundColor Cyan
Write-Host "  ██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗██║   ██║     ╚██╔╝  " -ForegroundColor Cyan
Write-Host "  ██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║██║   ██║      ██║   " -ForegroundColor Cyan
Write-Host "  ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝  " -ForegroundColor Cyan
Write-Host "                        Maturity App — start.ps1"
Write-Host ""

# ── Prérequis ─────────────────────────────────────────────────────────────────
info "Vérification des prérequis..."

$python = $null
foreach ($cmd in @("python", "python3")) {
    try {
        $v = & $cmd --version 2>&1
        if ($v -match "Python 3") { $python = $cmd; break }
    } catch {}
}
if (-not $python) { err "Python 3 non trouvé — installez-le depuis https://www.python.org/downloads/" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    err "Node.js non trouvé — installez-le depuis https://nodejs.org/"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    err "npm non trouvé — réinstallez Node.js depuis https://nodejs.org/"
}

$pyVer   = (& $python --version 2>&1) -replace "Python ", ""
$nodeVer = (node --version)
ok "Python $pyVer · Node $nodeVer"

# ── .env ──────────────────────────────────────────────────────────────────────
$envFile    = Join-Path $BACKEND ".env"
$envExample = Join-Path $BACKEND ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        info "Création du fichier .env depuis .env.example..."
        Copy-Item $envExample $envFile
    } else {
        info "Création du fichier .env par défaut..."
        @"
ANTHROPIC_API_KEY=sk-ant-your-key-here
DATABASE_URL=sqlite:///./maturity.db
UPLOAD_DIR=./uploads
ENV=development
"@ | Set-Content $envFile -Encoding UTF8
    }
    Write-Host ""
    Write-Host "  IMPORTANT : renseignez votre ANTHROPIC_API_KEY dans backend\.env" -ForegroundColor Red
    Write-Host "  Editez le fichier puis relancez .\start.ps1"
    Write-Host ""
    exit 0
}

$envContent = Get-Content $envFile -Raw
if ($envContent -match "your-key-here") {
    Write-Host ""
    Write-Host "  ANTHROPIC_API_KEY non configuree dans backend\.env" -ForegroundColor Red
    Write-Host "  Remplacez 'sk-ant-your-key-here' par votre vraie cle"
    Write-Host "  puis relancez .\start.ps1"
    Write-Host ""
    exit 0
}
ok ".env configuré"

# ── Backend — venv ─────────────────────────────────────────────────────────────
Set-Location $BACKEND

$venvPath    = Join-Path $BACKEND "venv"
$venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

if (-not (Test-Path $venvPath)) {
    info "Création du venv Python..."
    & $python -m venv venv
    ok "venv créé"
}

if (-not (Test-Path $venvActivate)) {
    err "Impossible de trouver le venv (Scripts\Activate.ps1 introuvable)"
}

info "Activation du venv..."
. $venvActivate

$installedMarker = Join-Path $venvPath ".installed"
$requirementsTxt = Join-Path $BACKEND "requirements.txt"

$needsInstall = (-not (Test-Path $installedMarker)) -or
                ((Get-Item $requirementsTxt).LastWriteTime -gt (Get-Item $installedMarker).LastWriteTime)

if ($needsInstall) {
    info "Installation des dépendances Python..."
    & pip install --upgrade pip -q
    & pip install -r $requirementsTxt -q
    New-Item -ItemType File -Force -Path $installedMarker | Out-Null
    ok "Dépendances Python installées"
} else {
    ok "Dépendances Python à jour"
}

# ── wkhtmltopdf (export PDF) ──────────────────────────────────────────────────
if (-not (Get-Command wkhtmltopdf -ErrorAction SilentlyContinue)) {
    info "wkhtmltopdf non trouvé — tentative d'installation via winget..."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        try {
            winget install --id wkhtmltopdf.wkhtmltopdf -e --silent
            ok "wkhtmltopdf installé via winget"
        } catch {
            Write-Host "  wkhtmltopdf non installé — export PDF indisponible" -ForegroundColor Yellow
            Write-Host "  Installez-le manuellement : winget install wkhtmltopdf.wkhtmltopdf"
        }
    } else {
        Write-Host "  wkhtmltopdf non installé — export PDF indisponible" -ForegroundColor Yellow
        Write-Host "  Installez-le manuellement : https://wkhtmltopdf.org/downloads.html"
    }
} else {
    ok "wkhtmltopdf disponible"
}

# ── Base de données ────────────────────────────────────────────────────────────
$dbFile = Join-Path $BACKEND "maturity.db"

if ($reset -and (Test-Path $dbFile)) {
    info "Reset de la base de données..."
    Remove-Item $dbFile -Force
    ok "DB supprimée"
}

if (-not (Test-Path $dbFile)) {
    info "Initialisation de la base de données..."
    & python -c @"
import sys; sys.path.insert(0, '.')
from database import Base, engine, init_upload_dir
Base.metadata.create_all(engine)
init_upload_dir()
print('Tables créées')
"@
    ok "Base de données initialisée"

    $env:PYTHONPATH = $BACKEND
    info "Chargement du framework JIP..."
    & python (Join-Path $SCRIPTS "seed_jip_framework.py")
    ok "Framework JIP chargé"

    info "Chargement des données de test..."
    & python (Join-Path $SCRIPTS "fake_data.py") --skip-framework
    ok "Données de test chargées (3 fournisseurs)"

    info "Chargement du catalogue de chantiers JIP..."
    & python (Join-Path $SCRIPTS "seed_jip_templates.py")
    ok "30 chantiers JIP chargés dans le catalogue"
    $env:PYTHONPATH = $null
} else {
    ok "Base de données existante conservée"
}

# ── Frontend — node_modules ────────────────────────────────────────────────────
Set-Location $FRONTEND

$nodeModules  = Join-Path $FRONTEND "node_modules"
$packageJson  = Join-Path $FRONTEND "package.json"
$lockFile     = Join-Path $FRONTEND "node_modules\.package-lock.json"

$needsNpmInstall = (-not (Test-Path $nodeModules)) -or
                   (-not (Test-Path $lockFile)) -or
                   ((Get-Item $packageJson).LastWriteTime -gt (Get-Item $lockFile -ErrorAction SilentlyContinue).LastWriteTime)

if ($needsNpmInstall) {
    info "Installation des dépendances npm..."
    npm install --silent
    ok "Dépendances npm installées"
} else {
    ok "Dépendances npm à jour"
}

# ── Libérer les ports 8000 et 5173 ────────────────────────────────────────────
Set-Location $ROOT
info "Nettoyage des ports 8000 et 5173..."

function Stop-Port {
    param([int]$port)
    $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' }
    foreach ($p in $pids) {
        try { taskkill /PID $p /F 2>$null | Out-Null } catch {}
    }
}

Stop-Port 8000
Stop-Port 5173
Start-Sleep -Seconds 1
ok "Ports libérés"

# ── Démarrage ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────"
Write-Host "   Démarrage des serveurs..."
Write-Host "  ─────────────────────────────────────────────────────"
Write-Host ""

$backendLog  = Join-Path $ROOT "backend.log"
$frontendLog = Join-Path $ROOT "frontend.log"

# Backend
$beProc = Start-Process -FilePath (Join-Path $venvPath "Scripts\uvicorn.exe") `
    -ArgumentList "main:app", "--reload", "--port", "8000", "--log-level", "warning" `
    -WorkingDirectory $BACKEND `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError  $backendLog `
    -PassThru -WindowStyle Hidden

Write-Host "  Backend PID : $($beProc.Id)  (logs -> backend.log)"

info "Attente du backend..."
$ready = $false
for ($i = 1; $i -le 20; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
    if ($i -eq 20) { err "Backend non démarré après 20s — vérifiez backend.log" }
}
ok "Backend prêt sur http://localhost:8000"

# Frontend
$feProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev -- --port 5173" `
    -WorkingDirectory $FRONTEND `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError  $frontendLog `
    -PassThru -WindowStyle Hidden

Write-Host "  Frontend PID : $($feProc.Id)  (logs -> frontend.log)"

info "Attente du frontend..."
$ready = $false
for ($i = 1; $i -le 25; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
    if ($i -eq 25) { err "Frontend non démarré après 25s — vérifiez frontend.log" }
}
ok "Frontend prêt sur http://localhost:5173"

# ── Résumé ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────"
Write-Host "  OK  Maturity App démarrée" -ForegroundColor Green
Write-Host "  ─────────────────────────────────────────────────────"
Write-Host ""
Write-Host "   App       ->  http://localhost:5173"
Write-Host "   API docs  ->  http://localhost:8000/docs"
Write-Host ""
Write-Host "   Logs BE   ->  Get-Content backend.log -Wait"
Write-Host "   Logs FE   ->  Get-Content frontend.log -Wait"
Write-Host ""
Write-Host "   Arreter   ->  Stop-Process -Id $($beProc.Id),$($feProc.Id)"
Write-Host "               (ou fermer cette fenetre)"
Write-Host ""
Write-Host "   Options   ->  .\start.ps1 -reset  (recrée la DB)"
Write-Host "  ─────────────────────────────────────────────────────"
Write-Host ""

# Garder le script actif pour capturer Ctrl+C
try {
    Write-Host "Appuyez sur Ctrl+C pour arrêter les serveurs..." -ForegroundColor Yellow
    while ($true) {
        Start-Sleep -Seconds 5
        if ($beProc.HasExited -or $feProc.HasExited) {
            Write-Host "Un serveur s'est arrêté inopinément — vérifiez les logs." -ForegroundColor Red
            break
        }
    }
} finally {
    info "Arrêt des serveurs..."
    Stop-Process -Id $beProc.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $feProc.Id -Force -ErrorAction SilentlyContinue
    ok "Serveurs arrêtés"
}
