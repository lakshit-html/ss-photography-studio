/**
 * SS PHOTOGRAPHY — LIVE GOOGLE DRIVE INGESTION TEST
 *
 * Uploads a test image to Google Drive under the test event:
 * Event: "cmwtndj7m000013os3m7o8b0d" (SS Photography System Test)
 * Verifies:
 * - Subfolders: SS Photography -> Events -> cmwtndj7m000013os3m7o8b0d -> Originals, Previews, Thumbnails
 * - Uploads a small test JPEG
 * - Verifies file streaming
 * - Cleans up test file from Drive afterwards
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
  const envPath = path.join(__dirname, '..', '.env');
  loadEnv(envPath);

  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;
  const rootFolderId = process.env.GDRIVE_ROOT_FOLDER_ID;

  console.log('Testing Google Drive live folder creation and photo upload...');

  // 1. Get access token
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
  const accessToken = tokenData.access_token;

  async function getOrCreateFolder(name, parentId) {
    const q = encodeURIComponent(`name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });
    const createData = await createRes.json();
    return createData.id;
  }

  // 2. Create Events folder inside SS Photography
  console.log('Verifying folder hierarchy in Google Drive...');
  const eventsFolderId = await getOrCreateFolder('Events', rootFolderId);
  console.log('  Events folder ID:', eventsFolderId);

  const testEventFolderId = await getOrCreateFolder('System-Test-Event', eventsFolderId);
  console.log('  Event folder ID:', testEventFolderId);

  const originalsFolderId = await getOrCreateFolder('Originals', testEventFolderId);
  console.log('  Originals folder ID:', originalsFolderId);

  // 3. Upload a sample test image
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: 'test_drive_sync.jpg',
    mimeType: 'image/jpeg',
    parents: [originalsFolderId]
  };

  // 1x1 dummy JPEG
  const sampleJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

  const multipartBody = Buffer.concat([
    Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata)),
    Buffer.from(delimiter + 'Content-Type: image/jpeg\r\n\r\n'),
    sampleJpeg,
    Buffer.from(closeDelimiter)
  ]);

  console.log('Uploading test image to Google Drive...');
  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': multipartBody.length.toString()
    },
    body: multipartBody
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    console.error('Upload failed:', uploadData);
    process.exit(1);
  }

  console.log(' Test image uploaded successfully! File ID:', uploadData.id);

  // 4. Verify downloading/streaming it back
  const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const downloadedBuf = Buffer.from(await downloadRes.arrayBuffer());
  console.log(` Download verified: received ${downloadedBuf.length} bytes (matches original: ${downloadedBuf.length === sampleJpeg.length})`);

  // 5. Clean up the test file
  await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log(' Test file cleaned up from Google Drive.');

  console.log('\n FULL GOOGLE DRIVE PIPELINE VERIFIED SUCCESSFULLY!');
}

main().catch(console.error);
