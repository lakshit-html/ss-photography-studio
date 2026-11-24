const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const { spawn } = require('child_process');

async function waitPort(port, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/branding`);
      if (res.status < 500) return true;
    } catch (e) {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for server on port ${port}`);
}

async function testHttpApi() {
  console.log('========================================================================');
  console.log('    TESTING COMPLETE LIVE HTTP API (/api/face/match) PIPELINE           ');
  console.log('========================================================================\n');

  const testEventId = 'cmwtndj7m000013os3m7o8b0d';
  const PORT = 3008;

  console.log(`Starting Next.js production server on port ${PORT}...`);
  const nextBin = path.resolve('node_modules/next/dist/bin/next');
  const server = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(PORT)], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (d) => process.stdout.write(`[Next.js stdout] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[Next.js stderr] ${d}`));

  try {
    await waitPort(PORT, 25000);
    console.log(`\nNext.js server is LIVE and responding on http://127.0.0.1:${PORT}!\n`);

    // Test 1: Search gallery with Image B (10.jpeg) -> MUST MATCH Image A (2.jpeg)
    console.log('--- TEST 1: Live HTTP POST /api/face/match with Image B (10.jpeg) ---');
    const imageBBuf = fs.readFileSync(path.resolve('tether_inbox/10.jpeg'));
    const blobB = new Blob([imageBBuf], { type: 'image/jpeg' });
    const formDataB = new FormData();
    formDataB.append('eventId', testEventId);
    formDataB.append('selfie', blobB, 'selfie.jpeg');
    formDataB.append('threshold', '0.42');

    const resB = await fetch(`http://127.0.0.1:${PORT}/api/face/match`, {
      method: 'POST',
      body: formDataB,
    });

    const jsonB = await resB.json();
    console.log(`HTTP Status: ${resB.status}`);
    console.log(`Response matches count: ${jsonB.matches ? jsonB.matches.length : 0}`);
    console.log('Matched photos in response:');
    for (const m of jsonB.matches || []) {
      console.log(`  - Photo ID: ${m.id}, Filename: ${m.filename}, Cosine Score: ${m.similarityScore.toFixed(4)}`);
    }

    assert.strictEqual(resB.status, 200, `Expected 200 OK, got ${resB.status}`);
    assert.ok(jsonB.matches && jsonB.matches.length >= 2, 'Expected at least 2 matches (self 10.jpeg + cross-photo 2.jpeg)');

    const match2Jpeg = jsonB.matches.find((m) => m.filename === '2.jpeg');
    assert.ok(match2Jpeg, 'Image A (2.jpeg) MUST appear in matched gallery results for Image B!');
    console.log(`✔ Cross-photo match confirmed via live HTTP API! Score: ${match2Jpeg.similarityScore.toFixed(4)} >= 0.42`);

    // Test 2: Search gallery with DIFFERENT person Image C (person1_a.jpg) -> MUST RETURN 0 MATCHES
    console.log('\n--- TEST 2: Live HTTP POST /api/face/match with Different Person (person1_a.jpg) ---');
    const imageCBuf = fs.readFileSync(path.resolve('tests/fixtures/person1_a.jpg'));
    const blobC = new Blob([imageCBuf], { type: 'image/jpeg' });
    const formDataC = new FormData();
    formDataC.append('eventId', testEventId);
    formDataC.append('selfie', blobC, 'different_person.jpg');
    formDataC.append('threshold', '0.42');

    const resC = await fetch(`http://127.0.0.1:${PORT}/api/face/match`, {
      method: 'POST',
      body: formDataC,
    });

    const jsonC = await resC.json();
    console.log(`HTTP Status: ${resC.status}`);
    console.log(`Response matches count: ${jsonC.matches ? jsonC.matches.length : 0}`);
    console.log(`Message: "${jsonC.message}"`);

    assert.strictEqual(resC.status, 200, `Expected 200 OK, got ${resC.status}`);
    assert.strictEqual(jsonC.matches.length, 0, 'Unrelated person MUST return 0 matches');
    console.log('✔ Zero false matches confirmed for unrelated person via live HTTP API!');

    // Test 3: Search gallery with base64 selfie format (simulating mobile browser canvas upload)
    console.log('\n--- TEST 3: Live HTTP POST /api/face/match with base64 dataURL (Mobile browser selfie) ---');
    const base64Data = `data:image/jpeg;base64,${imageBBuf.toString('base64')}`;
    const formDataBase64 = new FormData();
    formDataBase64.append('eventId', testEventId);
    formDataBase64.append('selfieBase64', base64Data);
    formDataBase64.append('threshold', '0.42');

    const resBase64 = await fetch(`http://127.0.0.1:${PORT}/api/face/match`, {
      method: 'POST',
      body: formDataBase64,
    });

    const jsonBase64 = await resBase64.json();
    console.log(`HTTP Status: ${resBase64.status}`);
    console.log(`Base64 selfie response matches count: ${jsonBase64.matches ? jsonBase64.matches.length : 0}`);
    assert.strictEqual(resBase64.status, 200);
    assert.ok(jsonBase64.matches.find((m) => m.filename === '2.jpeg'), 'Base64 selfie must match 2.jpeg');
    console.log('✔ Mobile canvas base64 selfie flow verified successfully via live HTTP API!');

    console.log('\n========================================================================');
    console.log('      ALL LIVE HTTP API END-TO-END PIPELINE CHECKS PASSED               ');
    console.log('========================================================================\n');
  } finally {
    console.log('Stopping Next.js server...');
    server.kill();
  }
}

testHttpApi().catch((err) => {
  console.error('HTTP API Test failed:', err);
  process.exit(1);
});
