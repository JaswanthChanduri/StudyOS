Dim shell
Set shell = CreateObject("WScript.Shell")

' Start the server silently in background
shell.Run "cmd /c cd /d C:\Users\jaswa\Downloads\StudyOS-v2-Final\StudyOS\backend && node src/server.js > C:\Users\jaswa\Downloads\StudyOS-v2-Final\StudyOS\studyos.log 2>&1", 0, False

' Wait 3 seconds for server to boot
WScript.Sleep 3000

' Open browser
shell.Run "http://localhost:3000/desktop"

Set shell = Nothing
