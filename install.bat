@echo off
echo ========================================
echo Titanium Kitten Karaoke - Installation
echo ========================================
echo.

REM Setze Fehlerbehandlung
setlocal enabledelayedexpansion

REM Prüfe ob Node.js installiert ist
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo FEHLER: Node.js ist nicht installiert oder nicht im PATH!
    echo Bitte installiere Node.js von https://nodejs.org/
    echo und versuche es erneut.
    pause
    exit /b 1
)

REM Prüfe ob Python installiert ist
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo FEHLER: Python ist nicht installiert oder nicht im PATH!
    echo Bitte installiere Python von https://python.org/
    echo und versuche es erneut.
    pause
    exit /b 1
)

REM Prüfe ob pip installiert ist
where pip >nul 2>nul
if %errorlevel% neq 0 (
    echo FEHLER: pip ist nicht installiert oder nicht im PATH!
    echo Bitte installiere pip und versuche es erneut.
    pause
    exit /b 1
)

echo [1/7] Installiere Server Dependencies...
echo ----------------------------------------
call npm install
if %errorlevel% neq 0 (
    echo FEHLER: Server Dependencies Installation fehlgeschlagen!
    pause
    exit /b 1
)
echo Server Dependencies erfolgreich installiert!
echo.

echo [2/7] Installiere Client Dependencies...
echo ----------------------------------------
cd client
call npm install
if %errorlevel% neq 0 (
    echo FEHLER: Client Dependencies Installation fehlgeschlagen!
    pause
    exit /b 1
)
cd ..
echo Client Dependencies erfolgreich installiert!
echo.

echo [3/7] Erstelle Python Virtual Environment...
echo ----------------------------------------
cd ai-services
if exist venv (
    echo Virtual Environment existiert bereits. Lösche altes venv...
    rmdir /s /q venv
)

call python -m venv venv
if %errorlevel% neq 0 (
    echo FEHLER: Virtual Environment konnte nicht erstellt werden!
    pause
    exit /b 1
)
echo Virtual Environment erfolgreich erstellt!
echo.

echo [4/7] Aktiviere Virtual Environment...
echo ----------------------------------------
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo FEHLER: Virtual Environment konnte nicht aktiviert werden!
    pause
    exit /b 1
)
echo Virtual Environment erfolgreich aktiviert!
echo.

echo [5/7] Installiere Python Dependencies...
echo ----------------------------------------
call pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo FEHLER: Python Dependencies Installation fehlgeschlagen!
    pause
    exit /b 1
)
echo Python Dependencies erfolgreich installiert!
echo.

echo [6/7] Erkenne CUDA Version...
echo ----------------------------------------
set CUDA_VERSION=
set CUDA_INDEX_URL=

REM Prüfe CUDA Version über nvcc
where nvcc >nul 2>nul
if %errorlevel% equ 0 (
    echo NVIDIA CUDA Toolkit gefunden. Prüfe CUDA Version...
    for /f "tokens=4" %%i in ('nvcc --version ^| findstr "release"') do (
        set CUDA_VERSION_RAW=%%i
    )
    echo CUDA Version gefunden: !CUDA_VERSION_RAW!
    
    REM Parse CUDA Version (z.B. "12.8" aus "release 12.8, V12.8.93")
    for /f "tokens=1 delims=." %%a in ("!CUDA_VERSION_RAW!") do set CUDA_MAJOR=%%a
    for /f "tokens=2 delims=." %%b in ("!CUDA_VERSION_RAW!") do set CUDA_MINOR=%%b
    
    REM Bestimme PyTorch Index URL basierend auf CUDA Version
    if "!CUDA_MAJOR!"=="12" (
        if "!CUDA_MINOR!"=="8" (
            set CUDA_VERSION=12.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
            echo CUDA Version erkannt: 12.8 (cu128)
        ) else if "!CUDA_MINOR!"=="7" (
            set CUDA_VERSION=12.7
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu127
            echo CUDA Version erkannt: 12.7 (cu127)
        ) else if "!CUDA_MINOR!"=="6" (
            set CUDA_VERSION=12.6
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu126
            echo CUDA Version erkannt: 12.6 (cu126)
        ) else (
            set CUDA_VERSION=12.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
            echo CUDA Version erkannt: 12.x (Fallback zu cu128)
        )
    ) else if "!CUDA_MAJOR!"=="11" (
        if "!CUDA_MINOR!"=="8" (
            set CUDA_VERSION=11.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu118
            echo CUDA Version erkannt: 11.8 (cu118)
        ) else if "!CUDA_MINOR!"=="7" (
            set CUDA_VERSION=11.7
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu117
            echo CUDA Version erkannt: 11.7 (cu117)
        ) else (
            set CUDA_VERSION=11.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu118
            echo CUDA Version erkannt: 11.x (Fallback zu cu118)
        )
    ) else (
        set CUDA_VERSION=12.8
        set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
        echo CUDA Version erkannt: Unbekannt (Fallback zu cu128)
    )
) else (
    echo Kein NVIDIA CUDA Toolkit gefunden. Installiere CPU-Version von PyTorch...
    set CUDA_VERSION=CPU
    set CUDA_INDEX_URL=https://download.pytorch.org/whl/cpu
)

echo.

echo [7/7] Installiere PyTorch für CUDA !CUDA_VERSION!...
echo ----------------------------------------
if "!CUDA_VERSION!"=="CPU" (
    echo Installiere PyTorch CPU-Version...
    call pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
) else (
    echo Installiere PyTorch für CUDA !CUDA_VERSION!...
    call pip install torch torchvision --index-url !CUDA_INDEX_URL!
)

if %errorlevel% neq 0 (
    echo WARNUNG: PyTorch Installation fehlgeschlagen!
    echo Versuche Fallback auf CPU-Version...
    call pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
    if %errorlevel% neq 0 (
        echo FEHLER: PyTorch Installation komplett fehlgeschlagen!
        pause
        exit /b 1
    )
    echo PyTorch CPU-Version erfolgreich installiert!
) else (
    echo PyTorch für CUDA !CUDA_VERSION! erfolgreich installiert!
)

cd ..

echo.
echo ========================================
echo Installation erfolgreich abgeschlossen!
echo ========================================
echo.
echo Was wurde installiert:
echo - Server Dependencies (Node.js)
echo - Client Dependencies (React)
echo - Python Virtual Environment
echo - Python Dependencies
echo - PyTorch für CUDA !CUDA_VERSION!
echo.
echo Nächste Schritte:
echo 1. Starte das System mit start-dev.bat (Entwicklung)
echo 2. Oder mit start.bat (Produktion)
echo.
echo Drücke eine beliebige Taste zum Beenden...
pause >nul
