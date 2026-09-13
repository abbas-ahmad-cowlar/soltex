' SolteX Stop
' Double-click to stop the SolteX dev servers.

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")

' Kill processes on port 3000 (Vite) and 3001 (Express) by finding their PIDs
WshShell.Run "cmd /c FOR /F ""tokens=5"" %a IN ('netstat -ano ^| findstr "":3000 "" ^| findstr ""LISTENING""') DO taskkill /F /T /PID %a >nul 2>&1", 0, True
WshShell.Run "cmd /c FOR /F ""tokens=5"" %a IN ('netstat -ano ^| findstr "":3001 "" ^| findstr ""LISTENING""') DO taskkill /F /T /PID %a >nul 2>&1", 0, True
