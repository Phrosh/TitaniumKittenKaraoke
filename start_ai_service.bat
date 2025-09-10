@echo off
echo 🚀 Starting AI Service with Virtual Environment
echo ================================================

cd ai-services
call venv\Scripts\activate.bat

echo.
echo 📦 Installing/updating dependencies...
pip install -r requirements.txt

echo.
echo 🐍 Starting AI Service on port 6000...
python app.py

pause
