@echo off
echo Starting RainCheck Weather App Server...
echo.
echo The app will open in your default browser.
echo Press Ctrl+C to stop the server.
echo.

REM Try Python 3 first
python -m http.server 8000 2>nul
if %errorlevel% neq 0 (
    REM Try Python 2 if Python 3 fails
    python -m SimpleHTTPServer 8000 2>nul
    if %errorlevel% neq 0 (
        echo Error: Python is not installed or not in PATH.
        echo Please install Python or open index.html directly in your browser.
        echo Note: Some features like ServiceWorker require a web server.
        pause
    )
)