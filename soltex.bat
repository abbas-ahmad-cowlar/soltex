@echo off
:: SolteX Launcher
:: Starts the dev server silently and opens the browser.

set "SOLTEX_DIR=%~dp0"
set "PORT=3000"
set "API_PORT=3001"

:: Check if server is already running on port 3000
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo SolteX is already running.
    start "" "http://localhost:%PORT%/dashboard.html"
    exit /b 0
)

:: Start the dev server in the background
echo Starting SolteX...
cd /d "%SOLTEX_DIR%"
start "" /b cmd /c "npm run dev > "%SOLTEX_DIR%\soltex.log" 2>&1"

:: Wait for BOTH servers to be ready (Vite on 3000 + Express on 3001)
set /a tries=0
:wait_loop
if %tries% geq 15 (
    echo SolteX failed to start. Check soltex.log for details.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
:: Check Vite (port 3000)
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    set /a tries+=1
    goto wait_loop
)
:: Check Express backend (port 3001)
netstat -ano | findstr ":%API_PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    set /a tries+=1
    goto wait_loop
)

:: Open in default browser
echo SolteX is ready!
start "" "http://localhost:%PORT%/dashboard.html"
exit /b 0

