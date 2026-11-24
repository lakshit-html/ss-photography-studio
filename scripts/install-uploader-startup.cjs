/**
 * SS PHOTOGRAPHY — WINDOWS AUTO-START INSTALLER
 *
 * Installs a Windows Startup shortcut so that:
 * 1. Nikon D750 Camera Uploader automatically starts when laptop boots up
 * 2. Runs silently in the background without popping up annoying command prompts
 * 3. Monitors tether_inbox continuously for new captures & deletions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const startupDir = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming'),
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup'
);

const projectDir = path.resolve(__dirname, '..');
const vbsTarget = path.join(__dirname, 'run-uploader-background.vbs');
const shortcutPath = path.join(startupDir, 'SS-Photography-Camera-Uploader.lnk');

if (!fs.existsSync(startupDir)) {
  fs.mkdirSync(startupDir, { recursive: true });
}

const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$Shortcut.TargetPath = 'wscript.exe'
$Shortcut.Arguments = '"${vbsTarget.replace(/'/g, "''")}"'
$Shortcut.WorkingDirectory = '${projectDir.replace(/'/g, "''")}'
$Shortcut.Description = 'SS Photography Nikon D750 Live Auto-Uploader & Sync Service'
$Shortcut.Save()
`;

try {
  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, { stdio: 'inherit' });

  console.log('=================================================================');
  console.log('  SS PHOTOGRAPHY — CAMERA UPLOADER AUTO-START INSTALLED!');
  console.log('=================================================================');
  console.log(`[INSTALLED] Shortcut created: ${shortcutPath}`);
  console.log('[BEHAVIOR]  Whenever laptop boots on, uploader starts automatically.');
  console.log('[MONITOR]   Watches tether_inbox for live uploads and auto-deletes.');
  console.log('=================================================================\n');
} catch (err) {
  console.error('[ERROR] Could not create startup shortcut:', err.message);
  process.exit(1);
}
