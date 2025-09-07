@echo off
echo Starting AI Services Python Server...
cd /d "%~dp0"
call venv\Scripts\activate
python app.py
pause
