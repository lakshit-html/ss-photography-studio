const fs = require('fs');
const path = require('path');
const { cosineSimilarity } = require('../src/lib/face-recognition.ts');

async function checkFaces() {
  const { FaceRecognitionService } = await import('../src/lib/face-recognition.ts');
  const files = [
    'tether_inbox/10.jpeg',
    'tether_inbox/11.jpeg',
    'tether_inbox/14.jpeg',
    'tether_inbox/2.jpeg',
    'tests/fixtures/person1_a.jpg',
    'tests/fixtures/person2.jpg'
  ];

  const detections = [];

  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    const faces = await FaceRecognitionService.detectFaces(buf);
    console.log(`\nFile: ${f} -> ${faces.length} face(s) detected:`);
    faces.forEach((face, idx) => {
      console.log(`  Face #${idx + 1}: box=${JSON.stringify(face.boundingBox)}, conf=${face.confidence.toFixed(3)}`);
      detections.push({ file: f, faceIdx: idx + 1, box: face.boundingBox, emb: face.embedding });
    });
  }

  console.log('\n========================================================================');
  console.log('            ALL PAIRWISE COSINE SIMILARITY ACROSS TEST FILES             ');
  console.log('========================================================================');

  for (let i = 0; i < detections.length; i++) {
    for (let j = i + 1; j < detections.length; j++) {
      const d1 = detections[i];
      const d2 = detections[j];
      const sim = cosineSimilarity(d1.emb, d2.emb);
      console.log(`${d1.file} (F${d1.faceIdx}) <-> ${d2.file} (F${d2.faceIdx}): similarity = ${sim.toFixed(4)}`);
    }
  }
}

checkFaces().catch(console.error);
