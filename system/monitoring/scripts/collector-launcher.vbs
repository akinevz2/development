' collector-launcher.vbs — windowless launcher for the metrics collector.
' Run by the SystemMonitorCollector scheduled task (see install-service.ps1);
' wscript is windowless and window style 0 hides the cmd/node consoles, so
' nothing ever flashes on the desktop at logon.
' Optional argument 0: absolute path to node.exe (falls back to PATH).
Option Explicit

Dim sh, fso, scriptDir, root, log, logDir, node, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(scriptDir)

log = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\system-monitoring\collector.log"
logDir = fso.GetParentFolderName(log)
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)

If WScript.Arguments.Count >= 1 Then
    node = """" & WScript.Arguments(0) & """"
Else
    node = "node.exe"
End If

cmd = "cmd /c cd /d """ & root & """ && " & node & " src\collector\src\index.ts >> """ & log & """ 2>&1"
sh.Run cmd, 0, False
