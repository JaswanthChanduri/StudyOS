' StudyOS Launcher - No CMD window appears
Dim shell, fso, dir
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' Run the bat file completely hidden
shell.Run "cmd /c """ & dir & "\StudyOS.bat""", 0, False

' Wait for server to start
WScript.Sleep 5000

' Open browser
shell.Run "http://localhost:3000/desktop"

Set shell = Nothing
Set fso = Nothing
