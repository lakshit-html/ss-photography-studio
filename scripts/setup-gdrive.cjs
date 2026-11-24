/**
 * SS PHOTOGRAPHY — GOOGLE DRIVE INTERACTIVE SETUP HELPER
 *
 * This script automates obtaining Google Drive OAuth2 credentials:
 * Zero external dependencies (uses Node.js built-in modules only).
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Lightweight zero-dependency .env parser
function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
  return env;
}

async function main() {
  console.log('\n======================================================');
  console.log('   SS PHOTOGRAPHY — GOOGLE DRIVE OAUTH2 SETUP HELPER');
  console.log('======================================================\n');

  const envPath = path.join(__dirname, '..', '.env');
  loadEnv(envPath);
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  // Check if args or env has client ID / secret
  let clientId = process.argv[2] || process.env.GDRIVE_CLIENT_ID;
  let clientSecret = process.argv[3] || process.env.GDRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('Usage: node scripts/setup-gdrive.cjs <CLIENT_ID> <CLIENT_SECRET>\n');
    console.log('To get your Client ID and Client Secret from Google Cloud Console:');
    console.log('1. Open: https://console.cloud.google.com/apis/credentials?project=luxe-lens-lfpeb');
    console.log('2. Click "+ CREATE CREDENTIALS" -> "OAuth client ID"');
    console.log('3. Application type: "Web application"');
    console.log(`4. Authorized redirect URIs: Add "${REDIRECT_URI}"`);
    console.log('5. Click Create, then copy Client ID and Client Secret.\n');
    console.log('Then run:');
    console.log('  node scripts/setup-gdrive.cjs\n');
    process.exit(0);
  }

  clientId = clientId.trim();
  clientSecret = clientSecret.trim();

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent'
    }).toString();

  console.log('Starting local listener for Google OAuth authorization...');

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      if (parsedUrl.pathname === '/oauth2callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h2>Authorization Failed</h2><p>Google returned error: ${error}</p>`);
          console.error(`Authorization error: ${error}`);
          server.close();
          process.exit(1);
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #10b981;">Google Drive Connected Successfully!</h1>
                <p>Your OAuth tokens have been captured and saved to SS Photography.</p>
                <p>You can close this browser tab and return to your terminal.</p>
              </body>
            </html>
          `);

          console.log('\nReceived OAuth code from Google! Exchanging for refresh token...');

          // Exchange code for tokens
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code: code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: REDIRECT_URI,
              grant_type: 'authorization_code'
            }).toString()
          });

          const tokenData = await tokenRes.json();
          if (!tokenRes.ok || !tokenData.refresh_token) {
            console.error('Failed to get refresh token:', tokenData);
            server.close();
            process.exit(1);
          }

          console.log('\n Refresh Token received successfully!');

          // Update .env
          let updatedEnv = envContent;
          const updateOrAppend = (key, val) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(updatedEnv)) {
              updatedEnv = updatedEnv.replace(regex, `${key}="${val}"`);
            } else {
              updatedEnv += `\n${key}="${val}"`;
            }
          };

          updateOrAppend('STORAGE_PROVIDER', 'gdrive');
          updateOrAppend('GDRIVE_CLIENT_ID', clientId);
          updateOrAppend('GDRIVE_CLIENT_SECRET', clientSecret);
          updateOrAppend('GDRIVE_REFRESH_TOKEN', tokenData.refresh_token);

          fs.writeFileSync(envPath, updatedEnv, 'utf8');
          console.log(' Updated .env with Google Drive credentials and STORAGE_PROVIDER="gdrive"');
          console.log('\nSetup complete! Google Drive is now ready to receive wedding photos.\n');

          server.close();
          process.exit(0);
        }
      }
    } catch (err) {
      console.error('Callback handling error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error: ' + err.message);
      server.close();
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log(`\nLocal server listening on http://localhost:${PORT}`);
    console.log('\nOpening your browser for Google authorization...');
    console.log('If browser does not open automatically, visit this URL:\n');
    console.log(authUrl + '\n');

    // Open browser on Windows
    exec(`start "" "${authUrl}"`);
  });
}

main().catch(console.error);
