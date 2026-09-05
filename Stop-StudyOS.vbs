Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "taskkill /F /IM node.exe", 0, True
MsgBox "StudyOS stopped.", 64, "StudyOS"
Set shell = Nothing
