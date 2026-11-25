Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ProjectDir = fso.GetParentFolderName(ScriptDir)

WshShell.CurrentDirectory = ProjectDir
NodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(NodeExe) Then
  NodeExe = "node"
End If

' Launch uploader cleanly in completely hidden background window (0 = hidden, False = non-blocking)
WshShell.Run "cmd /c """ & NodeExe & """ uploader\watch-uploader.mjs > uploader\uploader-service.log 2>&1", 0, False
