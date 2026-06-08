@echo off
cd /d "%~dp0"
echo Stopping old Python servers on port 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080.*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
echo.
echo Starting registration form server...
echo Open the URL shown below in Chrome desktop app (not Cursor preview).
echo.
python app.py
pause
