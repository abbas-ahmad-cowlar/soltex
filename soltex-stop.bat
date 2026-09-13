@echo off
:: SolteX Stop
:: Stops the SolteX dev servers (Vite on 3000, Express on 3001).

echo Stopping SolteX...

set "found=0"

:: Kill process listening on port 3000 (Vite)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /T /PID %%a >nul 2>&1
    set "found=1"
)

:: Kill process listening on port 3001 (Express)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /T /PID %%a >nul 2>&1
    set "found=1"
)

if "%found%"=="1" (
    echo SolteX stopped successfully.
) else (
    echo SolteX was not running.
)

timeout /t 2 /nobreak >nul
