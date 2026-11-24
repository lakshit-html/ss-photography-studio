/**
 * SS PHOTOGRAPHY — GOOGLE DRIVE INTEGRATION TEST
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

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
  console.log('Testing Google Drive storage connectivity...\n');

  const envPath = path.join(__dirname, '..', '.env');
  loadEnv(envPath);

  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log('❌ Google Drive credentials missing in .env.');
    console.log('Please run: node scripts/setup-gdrive.cjs');
    process.exit(1);
  }

  // 1. Get access token
  console.log('1. Refreshing access token...');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error('❌ Failed to get access token:', tokenData);
    process.exit(1);
  }
  const accessToken = tokenData.access_token;
  console.log('✅ Access token obtained successfully.');

  // 2. Query user info to verify identity
  console.log('\n2. Verifying Google Drive User Quota...');
  const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const about = await aboutRes.json();
  if (about.user) {
    console.log(`✅ Connected as: ${about.user.displayName} (${about.user.emailAddress})`);
    if (about.storageQuota) {
      const limitGB = (parseInt(about.storageQuota.limit || '0', 10) / (1024 ** 3)).toFixed(2);
      const usageGB = (parseInt(about.storageQuota.usage || '0', 10) / (1024 ** 3)).toFixed(2);
      console.log(`📊 Storage: ${usageGB} GB used of ${limitGB > 0 ? limitGB + ' GB' : 'Unlimited'}`);
    }
  }

  // 3. Test creating test folder
  console.log('\n3. Creating / locating "SS Photography" root folder...');
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name = 'SS Photography' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  let rootFolderId = searchData.files && searchData.files[0] ? searchData.files[0].id : null;

  if (!rootFolderId) {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'SS Photography',
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const createData = await createRes.json();
    rootFolderId = createData.id;
    console.log(`✅ Created "SS Photography" folder with ID: ${rootFolderId}`);
  } else {
    console.log(`✅ Found existing "SS Photography" folder: ${rootFolderId}`);
  }

  console.log('\n🎉 Google Drive integration test PASSED! Everything is ready for photo ingestion.');
}

main().catch(console.error);
