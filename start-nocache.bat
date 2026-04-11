@echo off
echo ========================================
echo RESTARTING SERVER WITH NO-CACHE HEADERS
echo ========================================
echo.
echo This will start the server with cache disabled
echo Open your browser to: http://localhost:8000
echo.
echo IMPORTANT: When the browser opens:
echo 1. Press F12 to open Developer Tools
echo 2. Go to Network tab
echo 3. Check "Disable cache"
echo 4. Keep Dev Tools open while testing
echo.
echo Press Ctrl+C to stop the server when done
echo.
pause
python -m http.server 8000 --bind 127.0.0.1
