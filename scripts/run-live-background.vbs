Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectDir = fso.GetParentFolderName(ScriptDir)

WshShell.CurrentDirectory = ProjectDir
WshShell.Run "cmd /c node scripts/start-live-platform.cjs >> background-service.log 2>&1", 0, False
