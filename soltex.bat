@echo off
:: SolteX Launcher
:: Starts both servers (Vite + Express) and opens the browser.
:: Close with: soltex-stop.bat  (or double-click soltex-stop.vbs)

:: --- Check if already running ---
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo SolteX is already running.
    start "" "http://localhost:3000/dashboard.html"
    exit /b 0
)

:: --- Start the dev server in a minimized window ---
echo Starting SolteX...
start "SolteX Server - Close this window to stop" /min /d "%~dp0" cmd /c "npm run dev > soltex.log 2>&1"

:: --- Wait for BOTH Vite (3000) and Express (3001) to be ready ---
set /a tries=0
:wait_loop
if %tries% geq 30 (
    echo ERROR: SolteX failed to start after 30 seconds.
    echo Check soltex.log for details.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
set /a tries+=1

:: Check Vite on port 3000
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 goto wait_loop

:: Check Express on port 3001
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 goto wait_loop

:: --- Both servers ready — open browser ---
echo SolteX is ready!
start "" "http://localhost:3000/dashboard.html"
exit /b 0
