#!/bin/bash

echo "Starting RainCheck Weather App Server..."
echo ""
echo "The app will be available at: http://localhost:8000"
echo "Press Ctrl+C to stop the server."
echo ""

# Try Python 3 first
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
else
    echo "Error: Python is not installed."
    echo "Please install Python or open index.html directly in your browser."
    echo "Note: Some features like ServiceWorker require a web server."
fi