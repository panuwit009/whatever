@echo off
cd /d "%~dp0"

echo Updating requirements.txt...
".\wayu-env\Scripts\python.exe" -m pip freeze > requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to update requirements.txt
    pause
    exit /b 1
)

echo.
echo requirements.txt updated successfully!
pause