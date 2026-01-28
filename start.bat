@echo off
echo ========================================
echo Titanium Kitten Karaoke - Production Mode
echo ========================================
echo.

REM Set error handling
setlocal enabledelayedexpansion

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH!
    echo Please install Node.js and try again.
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH!
    echo Please install Python and try again.
    pause
    exit /b 1
)

REM Ensure yt-dlp can use Node.js for EJS
set YTDLP_JS_RUNTIMES=node

echo [1/5] Building Client for Production...
echo ----------------------------------------
cd client
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Client build failed!
    pause
    exit /b 1
)
cd ..
echo Client build successful!
echo.

echo [2/5] Activating Python Virtual Environment...
echo ----------------------------------------
cd ai-services
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ERROR: Virtual Environment could not be activated!
    echo Make sure ai-services\venv exists.
    pause
    exit /b 1
)
echo Virtual Environment activated!
echo.

echo [3/5] Starting Python AI Services Server...
echo ----------------------------------------
start "AI Services" cmd /k "cd /d %~dp0ai-services && venv\Scripts\activate.bat && python app.py"
echo Python Server started!
echo.

echo [4/5] Installing Production Dependencies...
echo ----------------------------------------
cd ..
call npm install --production
if %errorlevel% neq 0 (
    echo WARNING: Production Dependencies installation failed!
    echo Trying to continue anyway...
)
echo Dependencies installed!
echo.

echo [5/5] Starting Node.js Production Server...
echo ----------------------------------------
start "Node.js Production Server" cmd /k "npm start"
echo Node.js Production Server started!
echo.

echo ========================================
echo All services have been started!
echo ========================================
echo.
echo Python AI Services: http://localhost:6000
echo Node.js Production Server: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul
