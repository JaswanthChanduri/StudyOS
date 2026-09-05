' StudyOS Silent Launcher
' Starts the server invisibly in the background
' No CMD window appears

Dim shell, fso, scriptDir, batFile

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the folder where this .vbs file lives
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batFile = scriptDir & "\start-silent.bat"

' Run start-silent.bat completely hidden (0 = hidden, False = don't wait)
shell.Run "cmd /c """ & batFile & """", 0, False

' Wait 4 seconds for server to boot, then open browser
WScript.Sleep 4000
shell.Run "http://localhost:3000/desktop"

Set shell = Nothing
Set fso = Nothing
