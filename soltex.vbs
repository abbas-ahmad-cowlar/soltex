' SolteX Launcher
' Double-click to start SolteX. Server runs minimized, browser opens when ready.
' To stop: double-click soltex-stop.vbs (or close the minimized server window).

Option Explicit

Dim WshShell, fso, projectDir
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' --- Check if already running (port 3000) ---
Dim checkCmd, exitCode
exitCode = WshShell.Run("cmd /c netstat -ano | findstr "":3000 "" | findstr ""LISTENING"" >nul 2>&1", 0, True)
If exitCode = 0 Then
    WshShell.Run "cmd /c start """" ""http://localhost:3000/dashboard.html""", 0, False
    WScript.Quit 0
End If

' --- Start the dev server in a minimized CMD window ---
WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd /k title SolteX Server && npm run dev 2>&1", 7, False
' Window style 7 = minimized, don't activate

' --- Wait for both ports to be ready (poll every second, up to 30s) ---
Dim tries, viteReady, expressReady
For tries = 1 To 30
    WScript.Sleep 1000

    ' Check Vite on port 3000
    viteReady = WshShell.Run("cmd /c netstat -ano | findstr "":3000 "" | findstr ""LISTENING"" >nul 2>&1", 0, True)

    ' Check Express on port 3001
    expressReady = WshShell.Run("cmd /c netstat -ano | findstr "":3001 "" | findstr ""LISTENING"" >nul 2>&1", 0, True)

    If viteReady = 0 And expressReady = 0 Then
        ' Both servers ready — open browser
        WshShell.Run "cmd /c start """" ""http://localhost:3000/dashboard.html""", 0, False
        WScript.Quit 0
    End If
Next

' --- Timeout — notify user ---
MsgBox "SolteX failed to start after 30 seconds." & vbCrLf & "Check soltex.log for details.", vbExclamation, "SolteX"
