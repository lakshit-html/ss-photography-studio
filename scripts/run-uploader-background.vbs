Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectDir = fso.GetParentFolderName(ScriptDir)

WshShell.CurrentDirectory = ProjectDir
' Run batch wrapper directly in completely hidden background window (0 = hidden, False = non-blocking)
WshShell.Run """" & ScriptDir & "\uploader-daemon.bat""", 0, False
