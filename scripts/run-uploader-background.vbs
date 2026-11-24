Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectDir = fso.GetParentFolderName(ScriptDir)

WshShell.CurrentDirectory = ProjectDir
' Launch uploader in completely silent background mode (0 = hidden, False = non-blocking)
WshShell.Run "cmd /c node uploader/watch-uploader.mjs >> uploader\uploader-service.log 2>&1", 0, False
