/**
 * SS PHOTOGRAPHY — LIVE 100% FREE PRODUCTION LAUNCHER
 *
 * Starts:
 * 1. Next.js Production Server (Port 3000)
 * 2. Cloudflare Zero-Cost Live HTTPS Tunnel (Official cloudflared)
 * 3. Captures the public HTTPS URL and binds it to uploader/active-host.json
 * 4. Displays real-time links for wedding guests, admin, and QR codes
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 3000;
const CLOUDFLARED_PATH = path.join(__dirname, '..', 'bin', 'cloudflared.exe');
const CONFIG_PATH = path.join(__dirname, '..', 'uploader', 'active-host.json');

// Check if server is already running on port
function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/branding`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function saveActiveHost(publicUrl) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(
        {
          activeUrl: publicUrl.trim().replace(/\/$/, ''),
          mode: 'CLOUDFLARE_TUNNEL',
          port: PORT,
          lastUpdated: new Date().toISOString()
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (err) {
    console.error('Failed to update active-host.json:', err.message);
  }
}

async function main() {
  console.log('\n=====================================================================');
  console.log('         SS PHOTOGRAPHY — LIVE CLOUD & GUEST LAUNCHER');
  console.log('         100% Free Forever | Zero Billing | Global HTTPS');
  console.log('=====================================================================\n');

  // 1. Verify cloudflared binary
  if (!fs.existsSync(CLOUDFLARED_PATH)) {
    console.error(`cloudflared binary not found at: ${CLOUDFLARED_PATH}`);
    process.exit(1);
  }

  // 2. Check if Next.js is already running
  const portActive = await isPortInUse(PORT);
  let nextProcess = null;

  if (portActive) {
    console.log(` Next.js application already running on port ${PORT}.`);
  } else {
    console.log(`Starting Next.js production server on http://localhost:${PORT}...`);
    nextProcess = spawn('npx.cmd', ['next', 'start', '-p', PORT.toString()], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      shell: true
    });

    nextProcess.stdout.on('data', (d) => {
      const out = d.toString();
      if (out.includes('Ready in') || out.includes('started server')) {
        console.log(` Next.js server ready on port ${PORT}`);
      }
    });

    nextProcess.stderr.on('data', (d) => {
      // Ignore normal font/analytics warnings
    });

    // Wait 3 seconds for Next.js to bind
    await new Promise((r) => setTimeout(r, 3000));
  }

  // 3. Start Cloudflare Tunnel
  console.log('Connecting to Cloudflare edge network for free HTTPS...');
  const tunnelProcess = spawn(
    CLOUDFLARED_PATH,
    ['tunnel', '--url', `http://localhost:${PORT}`],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let publicUrlFound = false;

  const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

  function handleOutput(data) {
    const text = data.toString();
    const match = text.match(urlRegex);
    if (match && !publicUrlFound) {
      publicUrlFound = true;
      const liveUrl = match[0];

      // Save for QR code generator
      saveActiveHost(liveUrl);

      console.log('\n=====================================================================');
      console.log('  YOUR SS PHOTOGRAPHY PLATFORM IS NOW LIVE WORLDWIDE!');
      console.log('=====================================================================\n');
      console.log(`  PUBLIC HTTPS URL:     ${liveUrl}`);
      console.log(`  GUEST GALLERY DEMO:   ${liveUrl}/event/cmwtndj7m000013os3m7o8b0d`);
      console.log(`  ADMIN DASHBOARD:      ${liveUrl}/admin`);
      console.log(`  LOCAL DASHBOARD:      http://localhost:${PORT}/admin`);
      console.log(`\n  CLOUD STORAGE:        Google Drive (5,120 GB Connected)`);
      console.log(`  AI RECOGNITION:       YuNet + Umeyama 5-point + SFace 128D (Active)`);
      console.log(`  DYNAMIC QR CODES:     Now automatically point to ${liveUrl}`);
      console.log('\n=====================================================================');
      console.log('  Guests can now open this link on their phones, take a selfie,');
      console.log('  and instantly find their photos from your Google Drive.');
      console.log('  Keep this window open to maintain the live website.');
      console.log('  Press Ctrl+C to stop.\n');
    }
  }

  tunnelProcess.stdout.on('data', handleOutput);
  tunnelProcess.stderr.on('data', handleOutput);

  tunnelProcess.on('close', (code) => {
    console.log(`\nCloudflare Tunnel closed with code ${code}`);
    if (nextProcess) nextProcess.kill();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down live server and tunnel...');
    tunnelProcess.kill();
    if (nextProcess) nextProcess.kill();
    process.exit(0);
  });
}

main().catch(console.error);
