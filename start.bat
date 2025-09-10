@echo off
echo ========================================
echo Titanium Kitten Karaoke - Production Mode
echo ========================================
echo.

REM Setze Fehlerbehandlung
setlocal enabledelayedexpansion

REM Prüfe ob Node.js installiert ist
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo FEHLER: Node.js ist nicht installiert oder nicht im PATH!
    echo Bitte installiere Node.js und versuche es erneut.
    pause
    exit /b 1
)

REM Prüfe ob Python installiert ist
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo FEHLER: Python ist nicht installiert oder nicht im PATH!
    echo Bitte installiere Python und versuche es erneut.
    pause
    exit /b 1
)

echo [1/5] Baue Client für Production...
echo ----------------------------------------
cd client
call npm run build
if %errorlevel% neq 0 (
    echo FEHLER: Client Build fehlgeschlagen!
    pause
    exit /b 1
)
cd ..
echo Client Build erfolgreich!
echo.

echo [2/5] Aktiviere Python Virtual Environment...
echo ----------------------------------------
cd ai-services
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo FEHLER: Virtual Environment konnte nicht aktiviert werden!
    echo Stelle sicher, dass ai-services\venv existiert.
    pause
    exit /b 1
)
echo Virtual Environment aktiviert!
echo.

echo [3/5] Starte Python AI Services Server...
echo ----------------------------------------
start "AI Services" cmd /k "cd /d %~dp0ai-services && venv\Scripts\activate.bat && python app.py"
echo Python Server gestartet!
echo.

echo [4/5] Installiere Production Dependencies...
echo ----------------------------------------
cd ..
call npm install --production
if %errorlevel% neq 0 (
    echo WARNUNG: Production Dependencies Installation fehlgeschlagen!
    echo Versuche trotzdem fortzufahren...
)
echo Dependencies installiert!
echo.

echo [5/5] Starte Node.js Production Server...
echo ----------------------------------------
start "Node.js Production Server" cmd /k "npm start"
echo Node.js Production Server gestartet!
echo.

echo ========================================
echo Alle Services wurden gestartet!
echo ========================================
echo.
echo Python AI Services: http://localhost:6000
echo Node.js Production Server: http://localhost:3000
echo.
echo Drücke eine beliebige Taste zum Beenden...
pause >nul
