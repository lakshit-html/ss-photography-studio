const fs = require('fs');
const path = require('path');
const { cosineSimilarity } = require('../src/lib/face-recognition.ts');

async function checkSampleCrossPhotos() {
  const { FaceRecognitionService } = await import('../src/lib/face-recognition.ts');
  const demoDir = 'node_modules/@vladmandic/face-api/demo';
  const samples = ['sample1.jpg', 'sample2.jpg', 'sample3.jpg', 'sample4.jpg', 'sample5.jpg', 'sample6.jpg'];

  const allFaces = [];

  for (const s of samples) {
    const p = path.join(demoDir, s);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    const faces = await FaceRecognitionService.detectFaces(buf, 0.6);
    console.log(`${s}: detected ${faces.length} faces`);
    faces.forEach((f, idx) => {
      allFaces.push({ sample: s, faceIdx: idx + 1, box: f.boundingBox, emb: f.embedding });
    });
  }

  console.log('\nChecking for cross-photo matches across samples (similarity > 0.40):');
  let crossMatches = 0;
  for (let i = 0; i < allFaces.length; i++) {
    for (let j = i + 1; j < allFaces.length; j++) {
      const f1 = allFaces[i];
      const f2 = allFaces[j];
      if (f1.sample !== f2.sample) {
        const sim = cosineSimilarity(f1.emb, f2.emb);
        if (sim >= 0.40) {
          crossMatches++;
          console.log(`MATCH! ${f1.sample} (F${f1.faceIdx}) <-> ${f2.sample} (F${f2.faceIdx}): similarity = ${sim.toFixed(4)}`);
        }
      }
    }
  }
  if (crossMatches === 0) {
    console.log('No cross-photo matches > 0.40 across samples (different groups/people in each sample).');
  }
}

checkSampleCrossPhotos().catch(console.error);
