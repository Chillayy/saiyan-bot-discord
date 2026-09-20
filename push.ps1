# Push your local changes to GitHub from Windows PowerShell.
#
#   .\push.ps1 "Describe what you changed"
#
# Safe by default: refuses to run on the wrong branch, refuses to commit secrets or live
# save data, shows you exactly what it is about to commit, and prints the deploy command
# for the VM when it's done.
#
# If PowerShell refuses to run it ("running scripts is disabled on this system"), either
# allow local scripts once:
#     Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# or bypass it for a single run:
#     powershell -ExecutionPolicy Bypass -File .\push.ps1 "Update bot"

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Message = "Update bot"
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# --- 1. Branch guard -----------------------------------------------------------------
# This repo's GitHub default branch is 'master', which holds unrelated old boilerplate.
# The real bot lives on 'main' - pushing from the wrong branch silently does nothing useful.
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') {
    Write-Host "ERROR: you are on branch '$branch', not 'main'." -ForegroundColor Red
    Write-Host "Fix it with:  git checkout main" -ForegroundColor Yellow
    exit 1
}

# --- 2. Secret guard -----------------------------------------------------------------
# These are gitignored, so they should never even appear here. If one does, something is
# wrong with .gitignore - stop rather than publish a token or your players' save data.
$forbidden = @('config/secrets.json', 'config/trello.json', 'config/config.json')
$changed = git status --porcelain | ForEach-Object { $_.Substring(3).Trim('"') }
$bad = $changed | Where-Object { $forbidden -contains $_ -or $_ -like 'data/*' }
if ($bad) {
    Write-Host "ERROR: these must never be committed: $($bad -join ', ')" -ForegroundColor Red
    Write-Host "They are gitignored - check .gitignore before continuing." -ForegroundColor Yellow
    exit 1
}

# --- 3. Anything to do? --------------------------------------------------------------
if (-not $changed) {
    Write-Host 'Nothing to push - the working tree is already clean.' -ForegroundColor Yellow
    exit 0
}

Write-Host 'About to commit:' -ForegroundColor Cyan
$changed | ForEach-Object { Write-Host "  $_" }
Write-Host ''

git add -A
git commit -m $Message
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPush failed. If it says 'non-fast-forward', pull first:" -ForegroundColor Red
    Write-Host '  git pull --rebase' -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host "`nPushed to GitHub. Now deploy it to the VM:" -ForegroundColor Green
Write-Host '  ssh saiyanbot' -ForegroundColor Green
Write-Host '  cd ~/saiyanbot && git pull && npm ci && sudo systemctl restart saiyanbot' -ForegroundColor Green
