@echo off
echo ========================================
echo Titanium Kitten Karaoke - Installation
echo ========================================
echo.

REM Set error handling
setlocal enabledelayedexpansion

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    echo and try again.
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH!
    echo Please install Python from https://python.org/
    echo and try again.
    pause
    exit /b 1
)

REM Check if pip is installed
where pip >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: pip is not installed or not in PATH!
    echo Please install pip and try again.
    pause
    exit /b 1
)

echo [1/7] Installing Server Dependencies...
echo ----------------------------------------
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Server Dependencies installation failed!
    pause
    exit /b 1
)
echo Server Dependencies successfully installed!
echo.

echo [2/7] Installing Client Dependencies...
echo ----------------------------------------
cd client
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Client Dependencies installation failed!
    pause
    exit /b 1
)
cd ..
echo Client Dependencies successfully installed!
echo.

echo [3/7] Creating Python Virtual Environment...
echo ----------------------------------------
cd ai-services
if exist venv (
    echo Virtual Environment already exists. Removing old venv...
    rmdir /s /q venv
)

call python -m venv venv
if %errorlevel% neq 0 (
    echo ERROR: Virtual Environment could not be created!
    pause
    exit /b 1
)
echo Virtual Environment successfully created!
echo.

echo [4/7] Activating Virtual Environment...
echo ----------------------------------------
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Virtual Environment could not be activated!
    pause
    exit /b 1
)
echo Virtual Environment successfully activated!
echo.

echo [5/7] Installing Python Dependencies...
echo ----------------------------------------
call pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Python Dependencies installation failed!
    pause
    exit /b 1
)
echo Python Dependencies successfully installed!
echo.

echo [6/7] Detecting CUDA Version...
echo ----------------------------------------
set CUDA_VERSION=
set CUDA_INDEX_URL=

REM Check CUDA version via nvcc
where nvcc >nul 2>nul
if %errorlevel% equ 0 (
    echo NVIDIA CUDA Toolkit found. Checking CUDA version...
    for /f "tokens=4" %%i in ('nvcc --version ^| findstr "release"') do (
        set CUDA_VERSION_RAW=%%i
    )
    echo CUDA Version found: !CUDA_VERSION_RAW!
    
    REM Parse CUDA Version (e.g. "12.8" from "release 12.8, V12.8.93")
    for /f "tokens=1 delims=." %%a in ("!CUDA_VERSION_RAW!") do set CUDA_MAJOR=%%a
    for /f "tokens=2 delims=." %%b in ("!CUDA_VERSION_RAW!") do set CUDA_MINOR=%%b
    
    REM Determine PyTorch Index URL based on CUDA version
    if "!CUDA_MAJOR!"=="12" (
        if "!CUDA_MINOR!"=="8" (
            set CUDA_VERSION=12.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
            echo CUDA Version detected: 12.8 (cu128)
        ) else if "!CUDA_MINOR!"=="7" (
            set CUDA_VERSION=12.7
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu127
            echo CUDA Version detected: 12.7 (cu127)
        ) else if "!CUDA_MINOR!"=="6" (
            set CUDA_VERSION=12.6
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu126
            echo CUDA Version detected: 12.6 (cu126)
        ) else (
            set CUDA_VERSION=12.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
            echo CUDA Version detected: 12.x (Fallback to cu128)
        )
    ) else if "!CUDA_MAJOR!"=="11" (
        if "!CUDA_MINOR!"=="8" (
            set CUDA_VERSION=11.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu118
            echo CUDA Version detected: 11.8 (cu118)
        ) else if "!CUDA_MINOR!"=="7" (
            set CUDA_VERSION=11.7
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu117
            echo CUDA Version detected: 11.7 (cu117)
        ) else (
            set CUDA_VERSION=11.8
            set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu118
            echo CUDA Version detected: 11.x (Fallback to cu118)
        )
    ) else (
        set CUDA_VERSION=12.8
        set CUDA_INDEX_URL=https://download.pytorch.org/whl/cu128
        echo CUDA Version detected: Unknown (Fallback to cu128)
    )
) else (
    echo No NVIDIA CUDA Toolkit found. Installing CPU version of PyTorch...
    set CUDA_VERSION=CPU
    set CUDA_INDEX_URL=https://download.pytorch.org/whl/cpu
)

echo.

echo [7/7] Installing PyTorch for CUDA !CUDA_VERSION!...
echo ----------------------------------------
if "!CUDA_VERSION!"=="CPU" (
    echo Installing PyTorch CPU version...
    call pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
) else (
    echo Installing PyTorch for CUDA !CUDA_VERSION!...
    call pip install torch torchvision --index-url !CUDA_INDEX_URL!
)

if %errorlevel% neq 0 (
    echo WARNING: PyTorch installation failed!
    echo Trying fallback to CPU version...
    call pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
    if %errorlevel% neq 0 (
        echo ERROR: PyTorch installation completely failed!
        pause
        exit /b 1
    )
    echo PyTorch CPU version successfully installed!
) else (
    echo PyTorch for CUDA !CUDA_VERSION! successfully installed!
)

cd ..

echo.
echo ========================================
echo Installation successfully completed!
echo ========================================
echo.
echo What was installed:
echo - Server Dependencies (Node.js)
echo - Client Dependencies (React)
echo - Python Virtual Environment
echo - Python Dependencies
echo - PyTorch for CUDA !CUDA_VERSION!
echo.
echo Next steps:
echo 1. Start the system with start-dev.bat (Development)
echo 2. Or with start.bat (Production)
echo.
echo Press any key to exit...
pause >nul
