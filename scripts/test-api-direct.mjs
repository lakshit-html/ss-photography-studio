import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { NextRequest } from 'next/server.js';

async function run() {
  console.log('========================================================================');
  console.log('      TESTING NEXT.JS ROUTE HANDLER (POST /api/face/match) DIRECTLY      ');
  console.log('========================================================================\n');

  const { POST } = await import('../src/app/api/face/match/route.ts');
  const testEventId = 'cmwtndj7m000013os3m7o8b0d';

  // TEST 1: Guest uploads Image B (10.jpeg) as a File in FormData
  console.log('--- TEST 1: POST /api/face/match with Image B (10.jpeg File) ---');
  const bufB = fs.readFileSync(path.resolve('tether_inbox/10.jpeg'));
  const fileB = new File([bufB], 'selfie.jpeg', { type: 'image/jpeg' });
  const formB = new FormData();
  formB.append('eventId', testEventId);
  formB.append('selfie', fileB);
  formB.append('threshold', '0.42');

  const reqB = new NextRequest('http://localhost:3000/api/face/match', {
    method: 'POST',
    body: formB,
  });

  const resB = await POST(reqB);
  const dataB = await resB.json();

  console.log(`Response HTTP Status: ${resB.status}`);
  console.log(`Matched photos count: ${dataB.matches ? dataB.matches.length : 0}`);
  for (const m of dataB.matches || []) {
    console.log(`  - Filename: ${m.filename.padEnd(12)} (Photo ID: ${m.id}) -> Score: ${m.score.toFixed(4)}, Confidence: ${m.confidenceTier}`);
  }

  assert.strictEqual(resB.status, 200);
  assert.ok(dataB.matches && dataB.matches.length >= 2, 'Must match at least 2 photos');

  const match2Jpeg = dataB.matches.find((m) => m.filename === '2.jpeg');
  assert.ok(match2Jpeg, 'Image A (2.jpeg) MUST be found when searching with Image B (10.jpeg)!');
  console.log(`✔ Cross-photo match verified through Next.js route handler! Score: ${match2Jpeg.score.toFixed(4)} >= 0.42`);

  // TEST 2: Different person Image C (person1_a.jpg)
  console.log('\n--- TEST 2: POST /api/face/match with Unrelated Person (person1_a.jpg) ---');
  const bufC = fs.readFileSync(path.resolve('tests/fixtures/person1_a.jpg'));
  const fileC = new File([bufC], 'different.jpg', { type: 'image/jpeg' });
  const formC = new FormData();
  formC.append('eventId', testEventId);
  formC.append('selfie', fileC);
  formC.append('threshold', '0.42');

  const reqC = new NextRequest('http://localhost:3000/api/face/match', {
    method: 'POST',
    body: formC,
  });

  const resC = await POST(reqC);
  const dataC = await resC.json();

  console.log(`Response HTTP Status: ${resC.status}`);
  console.log(`Matched photos count: ${dataC.matches ? dataC.matches.length : 0}`);
  console.log(`Message: "${dataC.message}"`);

  assert.strictEqual(resC.status, 200);
  assert.strictEqual(dataC.matches.length, 0, 'Unrelated person must return 0 matches');
  console.log('✔ Zero false matches confirmed for unrelated person through Next.js route handler!');

  // TEST 3: Base64 selfie (live phone camera canvas upload)
  console.log('\n--- TEST 3: POST /api/face/match with Base64 Selfie (Live Camera Canvas) ---');
  const base64Str = `data:image/jpeg;base64,${bufB.toString('base64')}`;
  const formBase64 = new FormData();
  formBase64.append('eventId', testEventId);
  formBase64.append('selfieBase64', base64Str);
  formBase64.append('threshold', '0.42');

  const reqBase64 = new NextRequest('http://localhost:3000/api/face/match', {
    method: 'POST',
    body: formBase64,
  });

  const resBase64 = await POST(reqBase64);
  const dataBase64 = await resBase64.json();

  console.log(`Response HTTP Status: ${resBase64.status}`);
  console.log(`Matched photos count: ${dataBase64.matches ? dataBase64.matches.length : 0}`);
  assert.strictEqual(resBase64.status, 200);
  assert.ok(dataBase64.matches.find((m) => m.filename === '2.jpeg'), 'Base64 selfie must match 2.jpeg');
  console.log('✔ Phone camera canvas base64 upload verified through Next.js route handler!');

  console.log('\n========================================================================');
  console.log('     ALL PRODUCTION API ROUTE TESTS PASSED (3/3)                        ');
  console.log('========================================================================\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('API route test failed:', err);
  process.exit(1);
});
