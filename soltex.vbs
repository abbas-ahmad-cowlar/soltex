' SolteX Silent Launcher
' Runs soltex.bat without showing a CMD window.
' Double-click this file or create a shortcut to it.

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "soltex.bat", 0, False
