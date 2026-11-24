/**
 * Creates a Windows Startup shortcut so SS Photography and Cloudflare Tunnel
 * automatically launch in the background every time the PC boots up.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const startupDir = path.join(
  process.env.APPDATA,
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup'
);

const vbsTarget = path.join(__dirname, 'run-live-background.vbs');
const shortcutPath = path.join(startupDir, 'SS-Photography-Live.lnk');

const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "\\"${vbsTarget.replace(/\\/g, '\\\\')}\\""
$Shortcut.WorkingDirectory = "${path.join(__dirname, '..').replace(/\\/g, '\\\\')}"
$Shortcut.Description = "SS Photography 24/7 Live Background Service"
$Shortcut.Save()
`;

try {
  execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`);
  console.log('✅ Windows Auto-Start Shortcut Installed Successfully!');
  console.log(`Shortcut created in: ${shortcutPath}`);
  console.log('SS Photography will now automatically start in the background when your PC boots up.');
} catch (err) {
  console.error('Failed to create startup shortcut:', err.message);
}
