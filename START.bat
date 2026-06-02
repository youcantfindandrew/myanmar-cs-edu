@echo off
echo Starting Code Myanmar...
echo.
echo Opening app at http://localhost:8080
echo Press Ctrl+C in this window to stop the server.
echo.
start "" "http://localhost:8080"
python -m http.server 8080
pause
