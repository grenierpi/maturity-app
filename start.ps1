# start.ps1 - Install + start Maturity App (Windows)
# Usage:
#   .\start.ps1         -> install if needed, then start
#   .\start.ps1 -reset  -> reset DB and reload data
#
# Prerequisites: Python 3.9+, Node.js 18+, npm
# If ExecutionPolicy blocks the script:
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

param(
    [switch]$reset
)

$ErrorActionPreference = "Stop"
trap {
    Write-Host ""
    Write-Host "X   UNEXPECTED ERROR: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to close..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$ROOT     = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND  = Join-Path $ROOT "backend"
$SCRIPTS  = Join-Path $BACKEND "scripts"
$FRONTEND = Join-Path $ROOT "frontend"

function ok   { param($msg) Write-Host "OK  $msg" -ForegroundColor Green }
function info { param($msg) Write-Host "->  $msg" -ForegroundColor Yellow }
function err  {
    param($msg)
    Write-Host ""
    Write-Host "X   ERROR: $msg" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to close..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host "              Maturity App - start.ps1" -ForegroundColor Cyan
Write-Host "  =====================================================" -ForegroundColor Cyan
Write-Host ""

# --- Prerequisites ---
info "Checking prerequisites..."

$python = $null
foreach ($cmd in @("python", "python3")) {
    try {
        $v = & $cmd --version 2>&1
        if ($v -match "Python 3") { $python = $cmd; break }
    } catch {}
}
if (-not $python) { err "Python 3 not found - install from https://www.python.org/downloads/" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    err "Node.js not found - install from https://nodejs.org/"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    err "npm not found - reinstall Node.js from https://nodejs.org/"
}

$pyVer   = (& $python --version 2>&1) -replace "Python ", ""
$nodeVer = (node --version)
ok "Python $pyVer / Node $nodeVer"

# --- .env ---
$envFile    = Join-Path $BACKEND ".env"
$envExample = Join-Path $BACKEND ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        info "Creating .env from .env.example..."
        Copy-Item $envExample $envFile
    } else {
        info "Creating default .env..."
        $defaultEnv = "ANTHROPIC_API_KEY=sk-ant-your-key-here`r`nDATABASE_URL=sqlite:///./maturity.db`r`nUPLOAD_DIR=./uploads`r`nENV=development"
        [System.IO.File]::WriteAllText($envFile, $defaultEnv, [System.Text.Encoding]::UTF8)
    }
    Write-Host ""
    Write-Host "  IMPORTANT: set your ANTHROPIC_API_KEY in backend\.env" -ForegroundColor Red
    Write-Host "  Edit the file then run .\start.ps1 again"
    Write-Host ""
    exit 0
}

$envContent = Get-Content $envFile -Raw
if ($envContent -match "your-key-here") {
    Write-Host ""
    Write-Host "  ANTHROPIC_API_KEY not set in backend\.env" -ForegroundColor Red
    Write-Host "  Replace 'sk-ant-your-key-here' with your real key"
    Write-Host "  then run .\start.ps1 again"
    Write-Host ""
    exit 0
}
ok ".env configured"

# --- Backend venv ---
Set-Location $BACKEND

$venvPath     = Join-Path $BACKEND "venv"
$venvActivate = Join-Path $venvPath "Scripts\Activate.ps1"

function New-Venv {
    info "Creating Python venv..."
    if (Test-Path $venvPath) { Remove-Item -Recurse -Force $venvPath }
    & $python -m venv $venvPath
    if ($LASTEXITCODE -ne 0) { err "python -m venv failed" }
    ok "venv created"
}

# Create venv if missing
if (-not (Test-Path $venvPath)) { New-Venv }

if (-not (Test-Path $venvActivate)) {
    err "Cannot find venv (Scripts\Activate.ps1 missing)"
}

info "Activating venv..."
. $venvActivate

# Verify pip is available; if not, recreate the venv
& python -m pip --version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    info "pip missing from venv - recreating..."
    New-Venv
    . $venvActivate
    & python -m pip --version 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { err "pip still missing after venv recreate - check your Python installation" }
    ok "pip available"
}

$installedMarker = Join-Path $venvPath ".installed"
$requirementsTxt = Join-Path $BACKEND "requirements.txt"

$needsInstall = (-not (Test-Path $installedMarker)) -or
                ((Get-Item $requirementsTxt).LastWriteTime -gt (Get-Item $installedMarker).LastWriteTime)

if ($needsInstall) {
    info "Installing Python dependencies..."
    & python -m pip install -r $requirementsTxt
    if ($LASTEXITCODE -ne 0) { err "pip install failed - check the error above" }
    New-Item -ItemType File -Force -Path $installedMarker | Out-Null
    ok "Python dependencies installed"
} else {
    ok "Python dependencies up to date"
}

# --- wkhtmltopdf (PDF export) ---
if (-not (Get-Command wkhtmltopdf -ErrorAction SilentlyContinue)) {
    info "wkhtmltopdf not found - trying winget..."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        winget install --id wkhtmltopdf.wkhtmltopdf -e --silent 2>$null
        if (Get-Command wkhtmltopdf -ErrorAction SilentlyContinue) {
            ok "wkhtmltopdf installed via winget"
        } else {
            Write-Host "  wkhtmltopdf not installed - PDF export unavailable" -ForegroundColor Yellow
            Write-Host "  Install manually: winget install wkhtmltopdf.wkhtmltopdf"
        }
    } else {
        Write-Host "  wkhtmltopdf not installed - PDF export unavailable" -ForegroundColor Yellow
        Write-Host "  Install manually: https://wkhtmltopdf.org/downloads.html"
    }
} else {
    ok "wkhtmltopdf available"
}

# --- Database ---
$dbFile = Join-Path $BACKEND "maturity.db"

if ($reset -and (Test-Path $dbFile)) {
    info "Resetting database..."
    Remove-Item $dbFile -Force
    ok "DB deleted"
}

if (-not (Test-Path $dbFile)) {
    info "Initialising database..."
    & python -c "import sys; sys.path.insert(0, '.'); from database import Base, engine, init_upload_dir; Base.metadata.create_all(engine); init_upload_dir(); print('Tables created')"
    ok "Database initialised"

    $env:PYTHONPATH = $BACKEND
    info "Loading JIP framework..."
    & python (Join-Path $SCRIPTS "seed_jip_framework.py")
    ok "JIP framework loaded"

    info "Loading test data..."
    & python (Join-Path $SCRIPTS "fake_data.py") --skip-framework
    ok "Test data loaded (3 suppliers)"

    info "Loading JIP project catalogue..."
    & python (Join-Path $SCRIPTS "seed_jip_templates.py")
    ok "30 JIP projects loaded"
    $env:PYTHONPATH = ""
} else {
    ok "Existing database kept"
}

# --- Frontend node_modules ---
Set-Location $FRONTEND

$nodeModules = Join-Path $FRONTEND "node_modules"
$packageJson = Join-Path $FRONTEND "package.json"
$lockFile    = Join-Path $FRONTEND "node_modules\.package-lock.json"

$needsNpmInstall = (-not (Test-Path $nodeModules)) -or
                   (-not (Test-Path $lockFile)) -or
                   ((Get-Item $packageJson).LastWriteTime -gt (Get-Item $lockFile -ErrorAction SilentlyContinue).LastWriteTime)

if ($needsNpmInstall) {
    info "Installing npm dependencies..."
    npm install --silent
    ok "npm dependencies installed"
} else {
    ok "npm dependencies up to date"
}

# --- Free ports 8000 and 5173 ---
Set-Location $ROOT
info "Freeing ports 8000 and 5173..."

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
ok "Ports freed"

# --- Start servers ---
Write-Host ""
Write-Host "  ----------------------------------------------------"
Write-Host "  Starting servers..."
Write-Host "  ----------------------------------------------------"
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

Write-Host "  Backend PID: $($beProc.Id)  (logs -> backend.log)"

info "Waiting for backend..."
$ready = $false
for ($i = 1; $i -le 20; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
    if ($i -eq 20) { err "Backend not started after 20s - check backend.log" }
}
ok "Backend ready at http://localhost:8000"

# Frontend
$feProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev -- --port 5173" `
    -WorkingDirectory $FRONTEND `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError  $frontendLog `
    -PassThru -WindowStyle Hidden

Write-Host "  Frontend PID: $($feProc.Id)  (logs -> frontend.log)"

info "Waiting for frontend..."
$ready = $false
for ($i = 1; $i -le 25; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
    if ($i -eq 25) { err "Frontend not started after 25s - check frontend.log" }
}
ok "Frontend ready at http://localhost:5173"

# --- Summary ---
Write-Host ""
Write-Host "  ----------------------------------------------------"
Write-Host "  OK  Maturity App started" -ForegroundColor Green
Write-Host "  ----------------------------------------------------"
Write-Host ""
Write-Host "   App      ->  http://localhost:5173"
Write-Host "   API docs ->  http://localhost:8000/docs"
Write-Host ""
Write-Host "   Logs BE  ->  Get-Content backend.log -Wait"
Write-Host "   Logs FE  ->  Get-Content frontend.log -Wait"
Write-Host ""
Write-Host "   Stop     ->  Stop-Process -Id $($beProc.Id),$($feProc.Id)"
Write-Host "              (or close this window)"
Write-Host ""
Write-Host "   Options  ->  .\start.ps1 -reset  (recreate DB)"
Write-Host "  ----------------------------------------------------"
Write-Host ""

# Keep script alive to catch Ctrl+C
try {
    Write-Host "Press Ctrl+C to stop servers..." -ForegroundColor Yellow
    while ($true) {
        Start-Sleep -Seconds 5
        if ($beProc.HasExited -or $feProc.HasExited) {
            Write-Host "A server stopped unexpectedly - check the logs." -ForegroundColor Red
            break
        }
    }
} finally {
    info "Stopping servers..."
    Stop-Process -Id $beProc.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $feProc.Id -Force -ErrorAction SilentlyContinue
    ok "Servers stopped"
}
