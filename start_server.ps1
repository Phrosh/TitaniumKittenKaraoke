Write-Host "Starting AI Services Python Server..." -ForegroundColor Green
Set-Location $PSScriptRoot
& ".\venv\Scripts\Activate.ps1"
python app.py
