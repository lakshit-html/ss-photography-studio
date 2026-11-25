/**
 * SS PHOTOGRAPHY — WINDOWS AUTO-START INSTALLER
 *
 * Configures Windows so that whenever the PC starts / logs in:
 * 1. Any legacy conflicting local-server startup shortcut (SS-Photography-Live.lnk) is removed.
 * 2. Nikon D750 Camera Uploader automatically starts silently in the background.
 * 3. Continuously monitors tether_inbox and syncs uploads & deletions straight to the live website.
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
const legacyShortcutPath = path.join(startupDir, 'SS-Photography-Live.lnk');

if (!fs.existsSync(startupDir)) {
  fs.mkdirSync(startupDir, { recursive: true });
}

// 1. Remove conflicting legacy localhost launcher if present
if (fs.existsSync(legacyShortcutPath)) {
  try {
    fs.unlinkSync(legacyShortcutPath);
    console.log(`[CLEANUP] Removed conflicting legacy shortcut: ${legacyShortcutPath}`);
  } catch (err) {
    console.warn(`[WARN] Could not remove legacy shortcut: ${err.message}`);
  }
}

// 2. Create clean Startup folder shortcut (.lnk)
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

  // 3. Also ensure HKCU Run key points directly to silent VBS launcher for rock-solid PC boot startup
  const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "SSPhotographyCameraUploader" /t REG_SZ /d "wscript.exe \\"${vbsTarget}\\"" /f`;
  execSync(regCmd, { stdio: 'pipe' });

  console.log('=================================================================');
  console.log('  SS PHOTOGRAPHY — CAMERA UPLOADER AUTO-START INSTALLED!');
  console.log('=================================================================');
  console.log(`[STARTUP LNK] ${shortcutPath}`);
  console.log(`[REGISTRY RUN] HKCU\\...\\Run\\SSPhotographyCameraUploader`);
  console.log('[BEHAVIOR]    Whenever PC turns on, uploader starts silently in background.');
  console.log('[SYNC TARGET] Live Cloud Website (https://ss-photography-studio.vercel.app)');
  console.log('=================================================================\n');
} catch (err) {
  console.error('[ERROR] Could not configure Windows auto-start:', err.message);
  process.exit(1);
}
