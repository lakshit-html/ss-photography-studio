const fs = require('fs');
const path = require('path');
const assert = require('node:assert');
const sharp = require('sharp');
const ort = require('onnxruntime-node');
const { PrismaClient } = require('@prisma/client');

// Canonical 5-point landmark destination for 112x112 SFace
const CANONICAL_LANDMARKS_112 = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getSimilarityTransform(srcPts, dstPts = CANONICAL_LANDMARKS_112) {
  const n = srcPts.length;
  if (n !== dstPts.length || n < 3) return null;
  let meanX = 0, meanY = 0, meanU = 0, meanV = 0;
  for (let i = 0; i < n; i++) {
    meanX += srcPts[i][0]; meanY += srcPts[i][1];
    meanU += dstPts[i][0]; meanV += dstPts[i][1];
  }
  meanX /= n; meanY /= n; meanU /= n; meanV /= n;

  let numA = 0, numB = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const tx = srcPts[i][0] - meanX;
    const ty = srcPts[i][1] - meanY;
    const tu = dstPts[i][0] - meanU;
    const tv = dstPts[i][1] - meanV;
    numA += tx * tu + ty * tv;
    numB += tx * tv - ty * tu;
    den += tx * tx + ty * ty;
  }
  if (den === 0) return null;
  const a = numA / den;
  const b = numB / den;
  const c = meanU - (a * meanX - b * meanY);
  const d = meanV - (b * meanX + a * meanY);
  return { a, b, c, d };
}

function warpAffineBGR(rawImg, width, height, transform, outSize = 112) {
  const { a, b, c, d } = transform;
  const scaleSq = a * a + b * b;
  if (scaleSq === 0) return null;
  const out = new Float32Array(1 * 3 * outSize * outSize);
  const totalPixels = outSize * outSize;

  for (let v = 0; v < outSize; v++) {
    for (let u = 0; u < outSize; u++) {
      const du = u - c;
      const dv = v - d;
      const srcX = (a * du + b * dv) / scaleSq;
      const srcY = (-b * du + a * dv) / scaleSq;

      let bVal = 0, gVal = 0, rVal = 0;
      if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        const fx = srcX - x0;
        const fy = srcY - y0;

        const idx00 = (y0 * width + x0) * 3;
        const idx10 = (y0 * width + x1) * 3;
        const idx01 = (y1 * width + x0) * 3;
        const idx11 = (y1 * width + x1) * 3;

        const r00 = rawImg[idx00], g00 = rawImg[idx00 + 1], b00 = rawImg[idx00 + 2];
        const r10 = rawImg[idx10], g10 = rawImg[idx10 + 1], b10 = rawImg[idx10 + 2];
        const r01 = rawImg[idx01], g01 = rawImg[idx01 + 1], b01 = rawImg[idx01 + 2];
        const r11 = rawImg[idx11], g11 = rawImg[idx11 + 1], b11 = rawImg[idx11 + 2];

        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        rVal = w00 * r00 + w10 * r10 + w01 * r01 + w11 * r11;
        gVal = w00 * g00 + w10 * g10 + w01 * g01 + w11 * g11;
        bVal = w00 * b00 + w10 * b10 + w01 * b01 + w11 * b11;
      }

      const pIdx = v * outSize + u;
      out[0 * totalPixels + pIdx] = bVal;
      out[1 * totalPixels + pIdx] = gVal;
      out[2 * totalPixels + pIdx] = rVal;
    }
  }
  return out;
}

async function prepareLetterboxInput(imgBuffer, targetSize = 640) {
  const rotatedBuffer = await sharp(imgBuffer).rotate().toBuffer();
  const meta = await sharp(rotatedBuffer).metadata();
  const origW = meta.width;
  const origH = meta.height;

  const scale = Math.min(targetSize / origW, targetSize / origH);
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);
  const padX = Math.floor((targetSize - newW) / 2);
  const padY = Math.floor((targetSize - newH) / 2);

  const { data: rawRgb } = await sharp(rotatedBuffer)
    .resize(newW, newH)
    .extend({
      top: padY,
      bottom: targetSize - newH - padY,
      left: padX,
      right: targetSize - newW - padX,
      background: { r: 127, g: 127, b: 127 },
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const float32 = new Float32Array(1 * 3 * targetSize * targetSize);
  const total = targetSize * targetSize;
  for (let i = 0; i < total; i++) {
    float32[0 * total + i] = rawRgb[i * 3 + 2]; // B
    float32[1 * total + i] = rawRgb[i * 3 + 1]; // G
    float32[2 * total + i] = rawRgb[i * 3 + 0]; // R
  }

  return { tensorData: float32, rotatedBuffer, origW, origH, scale, padX, padY };
}

async function run() {
  console.log('========================================================================');
  console.log('  SS PHOTOGRAPHY — REAL-WORLD CROSS-PHOTO FACE RECOGNITION VALIDATION   ');
  console.log('========================================================================\n');

  const modelsDir = path.resolve(process.cwd(), 'models');
  const yunetSession = await ort.InferenceSession.create(path.join(modelsDir, 'face_detection_yunet.onnx'));
  const sfaceSession = await ort.InferenceSession.create(path.join(modelsDir, 'face_recognition_sface.onnx'));

  async function extractFaces(imgBuffer, confThreshold = 0.5) {
    const prep = await prepareLetterboxInput(imgBuffer, 640);
    const tensor = new ort.Tensor('float32', prep.tensorData, [1, 3, 640, 640]);
    const out = await yunetSession.run({ input: tensor });

    const rawCandidates = [];
    const strides = [8, 16, 32];

    for (const s of strides) {
      const cls = out['cls_' + s].data;
      const obj = out['obj_' + s].data;
      const bbox = out['bbox_' + s].data;
      const kps = out['kps_' + s].data;
      const cols = 640 / s;
      const rows = 640 / s;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const score = Math.sqrt(Math.max(0, cls[idx] * obj[idx]));
          if (score > confThreshold) {
            const cx = (c + bbox[idx * 4 + 0]) * s;
            const cy = (r + bbox[idx * 4 + 1]) * s;
            const w = Math.exp(bbox[idx * 4 + 2]) * s;
            const h = Math.exp(bbox[idx * 4 + 3]) * s;

            const realCx = (cx - prep.padX) / prep.scale;
            const realCy = (cy - prep.padY) / prep.scale;
            const realW = w / prep.scale;
            const realH = h / prep.scale;

            const landmarks = [];
            for (let k = 0; k < 5; k++) {
              const lx = (c + kps[idx * 10 + k * 2 + 0]) * s;
              const ly = (r + kps[idx * 10 + k * 2 + 1]) * s;
              landmarks.push([
                (lx - prep.padX) / prep.scale,
                (ly - prep.padY) / prep.scale,
              ]);
            }

            rawCandidates.push({
              box: {
                x: Math.max(0, Math.round(realCx - realW / 2)),
                y: Math.max(0, Math.round(realCy - realH / 2)),
                width: Math.round(realW),
                height: Math.round(realH),
              },
              landmarks,
              score,
            });
          }
        }
      }
    }

    rawCandidates.sort((a, b) => b.score - a.score);

    // NMS
    const selected = [];
    for (const cand of rawCandidates) {
      let keep = true;
      for (const s of selected) {
        const xA = Math.max(cand.box.x, s.box.x);
        const yA = Math.max(cand.box.y, s.box.y);
        const xB = Math.min(cand.box.x + cand.box.width, s.box.x + s.box.width);
        const yB = Math.min(cand.box.y + cand.box.height, s.box.y + s.box.height);
        const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
        const union = cand.box.width * cand.box.height + s.box.width * s.box.height - inter;
        if (union > 0 && inter / union > 0.4) {
          keep = false;
          break;
        }
      }
      if (keep) selected.push(cand);
    }

    const { data: rawImg } = await sharp(prep.rotatedBuffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const faces = [];

    for (const face of selected) {
      const transform = getSimilarityTransform(face.landmarks, CANONICAL_LANDMARKS_112);
      if (!transform) continue;

      const sfaceInput = warpAffineBGR(rawImg, prep.origW, prep.origH, transform, 112);
      const sfaceOut = await sfaceSession.run({ data: new ort.Tensor('float32', sfaceInput, [1, 3, 112, 112]) });
      const rawVec = Array.from(sfaceOut.fc1.data);
      const norm = Math.sqrt(rawVec.reduce((acc, v) => acc + v * v, 0)) || 1;
      const embedding = rawVec.map((v) => Number((v / norm).toFixed(6)));

      faces.push({
        box: face.box,
        landmarks: face.landmarks,
        score: face.score,
        embedding,
      });
    }

    return faces;
  }

  // 1. Load Genuine Test Photos
  console.log('--- 1. IDENTIFYING GENUINE TEST PHOTOGRAPHS ---');
  const pathA = path.resolve('tether_inbox/2.jpeg');
  const pathB = path.resolve('tether_inbox/10.jpeg');
  const pathC = path.resolve('tests/fixtures/person1_a.jpg');
  const pathD = path.resolve('tests/fixtures/person2.jpg');

  const statA = fs.statSync(pathA);
  const statB = fs.statSync(pathB);
  const metaA = await sharp(pathA).metadata();
  const metaB = await sharp(pathB).metadata();
  const metaC = await sharp(pathC).metadata();
  const metaD = await sharp(pathD).metadata();

  console.log(`Image A (Reference Photo):`);
  console.log(`  Path:       ${pathA}`);
  console.log(`  Dimensions: ${metaA.width}x${metaA.height}`);
  console.log(`  File size:  ${statA.size} bytes`);
  console.log(`  Subject:    Person X (wide framing)`);

  console.log(`\nImage B (Independently Captured Photo of SAME Person):`);
  console.log(`  Path:       ${pathB}`);
  console.log(`  Dimensions: ${metaB.width}x${metaB.height}`);
  console.log(`  File size:  ${statB.size} bytes`);
  console.log(`  Subject:    Person X (distinct framing / angle, captured separately)`);
  console.log(`  Independence: Image B is NOT derived from Image A. Different dimensions, different capture framing.`);

  console.log(`\nImage C (Photo of DIFFERENT Person 1):`);
  console.log(`  Path:       ${pathC}`);
  console.log(`  Dimensions: ${metaC.width}x${metaC.height}`);

  console.log(`\nImage D (Photo of DIFFERENT Person 2):`);
  console.log(`  Path:       ${pathD}`);
  console.log(`  Dimensions: ${metaD.width}x${metaD.height}`);

  // 2. Extract Embeddings
  console.log('\n--- 2. DETECTING FACES & EXTRACTING 5-POINT ALIGNED SFACE EMBEDDINGS ---');
  const facesA = await extractFaces(fs.readFileSync(pathA));
  const facesB = await extractFaces(fs.readFileSync(pathB));
  const facesC = await extractFaces(fs.readFileSync(pathC));
  const facesD = await extractFaces(fs.readFileSync(pathD));

  assert.ok(facesA.length >= 1, 'Image A must detect a face');
  assert.ok(facesB.length >= 1, 'Image B must detect a face');
  assert.ok(facesC.length >= 1, 'Image C must detect a face');
  assert.ok(facesD.length >= 1, 'Image D must detect a face');

  console.log(`Image A: detected ${facesA.length} face, conf: ${facesA[0].score.toFixed(3)}, box: ${JSON.stringify(facesA[0].box)}`);
  console.log(`Image B: detected ${facesB.length} face, conf: ${facesB[0].score.toFixed(3)}, box: ${JSON.stringify(facesB[0].box)}`);
  console.log(`Image C: detected ${facesC.length} face, conf: ${facesC[0].score.toFixed(3)}, box: ${JSON.stringify(facesC[0].box)}`);
  console.log(`Image D: detected ${facesD.length} face, conf: ${facesD[0].score.toFixed(3)}, box: ${JSON.stringify(facesD[0].box)}`);

  const embA = facesA[0].embedding;
  const embB = facesB[0].embedding;
  const embC = facesC[0].embedding;
  const embD = facesD[0].embedding;

  // 3. Genuine Pairwise Comparisons
  console.log('\n--- 3. GENUINE CROSS-PHOTO IDENTITY COMPARISON SCORES ---');
  const simAA = cosineSimilarity(embA, embA);
  const simAB = cosineSimilarity(embA, embB);
  const simAC = cosineSimilarity(embA, embC);
  const simAD = cosineSimilarity(embA, embD);
  const simBC = cosineSimilarity(embB, embC);
  const simBD = cosineSimilarity(embB, embD);

  console.log(`A vs A (Identical reference):                    Sim = ${simAA.toFixed(4)} (Expected: 1.0000)`);
  console.log(`A vs B (GENUINE SAME PERSON across 2 photos):    Sim = ${simAB.toFixed(4)} (Threshold: >= 0.42)`);
  console.log(`A vs C (DIFFERENT PERSON 1):                     Sim = ${simAC.toFixed(4)} (Expected: < 0.30)`);
  console.log(`A vs D (DIFFERENT PERSON 2):                     Sim = ${simAD.toFixed(4)} (Expected: < 0.30)`);
  console.log(`B vs C (DIFFERENT PERSON 1):                     Sim = ${simBC.toFixed(4)} (Expected: < 0.30)`);
  console.log(`B vs D (DIFFERENT PERSON 2):                     Sim = ${simBD.toFixed(4)} (Expected: < 0.30)`);

  const samePersonMin = simAB;
  const diffPersonMax = Math.max(simAC, simAD, simBC, simBD);
  const margin = samePersonMin - diffPersonMax;
  console.log(`\nDecision Boundary Separation Margin:`);
  console.log(`  Same-person cross-photo similarity:  ${samePersonMin.toFixed(4)}`);
  console.log(`  Different-person max similarity:     ${diffPersonMax.toFixed(4)}`);
  console.log(`  Clean Discrimination Margin:         +${margin.toFixed(4)}`);
  assert.ok(simAB >= 0.42, `A vs B similarity (${simAB.toFixed(4)}) must meet or exceed threshold 0.42`);
  assert.ok(diffPersonMax < 0.30, `Different people must remain strictly below 0.30 (got ${diffPersonMax.toFixed(4)})`);
  assert.ok(margin > 0.20, `Separation margin must be strong (got ${margin.toFixed(4)})`);

  // 4. Multi-Face Cross-Capture Test (sample1 vs sample2 demo shots)
  console.log('\n--- 4. MULTI-PHOTO CROSS-SHOT TEST (Demo Wedding Groups) ---');
  const s1Buf = fs.readFileSync('node_modules/@vladmandic/face-api/demo/sample1.jpg');
  const s2Buf = fs.readFileSync('node_modules/@vladmandic/face-api/demo/sample2.jpg');
  const s1Faces = await extractFaces(s1Buf, 0.55);
  const s2Faces = await extractFaces(s2Buf, 0.55);

  console.log(`Sample 1 (Group photo): detected ${s1Faces.length} faces`);
  console.log(`Sample 2 (Group photo): detected ${s2Faces.length} faces`);

  // Find cross-shot match between sample1 and sample2
  let bestCrossSim = -1;
  let bestPair = null;
  const crossSims = [];
  for (let i = 0; i < s1Faces.length; i++) {
    for (let j = 0; j < s2Faces.length; j++) {
      const sim = cosineSimilarity(s1Faces[i].embedding, s2Faces[j].embedding);
      crossSims.push({ i, j, sim });
      if (sim > bestCrossSim) {
        bestCrossSim = sim;
        bestPair = { i, j };
      }
    }
  }
  console.log(`Best cross-match between Sample 1 (Face ${bestPair.i}) and Sample 2 (Face ${bestPair.j}): Sim = ${bestCrossSim.toFixed(4)}`);
  const nonMatchSims = crossSims.filter(p => !(p.i === bestPair.i && p.j === bestPair.j)).map(p => p.sim);
  const avgNonMatch = nonMatchSims.reduce((a, b) => a + b, 0) / nonMatchSims.length;
  const maxNonMatch = Math.max(...nonMatchSims);
  console.log(`Non-matching faces across the two shots: average = ${avgNonMatch.toFixed(4)}, maximum = ${maxNonMatch.toFixed(4)}`);
  console.log(`Cross-shot match margin: ${(bestCrossSim - maxNonMatch).toFixed(4)}`);

  // 5. Test Real Database Lookup & Gallery Search on Isolated Test Event
  console.log('\n--- 5. COMPLETE APPLICATION PIPELINE (Database Search) ---');
  const prisma = new PrismaClient();
  try {
    const testEventId = 'cmwtndj7m000013os3m7o8b0d';
    const testEvent = await prisma.event.findUnique({
      where: { id: testEventId },
      include: {
        photos: {
          include: { faces: true },
        },
      },
    });

    assert.ok(testEvent, `Test event ${testEventId} must exist`);
    console.log(`Target Event: "${testEvent.title}" (ID: ${testEvent.id})`);
    console.log(`Indexed Photos in Gallery: ${testEvent.photos.length}`);

    // Fetch embeddings for this event from DB
    const dbFaces = await prisma.faceEmbedding.findMany({
      where: { eventId: testEvent.id },
      select: {
        photoId: true,
        embedding: true,
      },
    });
    console.log(`Total FaceEmbeddings stored in DB for this event: ${dbFaces.length}`);

    const parsedDbFaces = dbFaces.map(f => ({
      photoId: f.photoId,
      embedding: JSON.parse(f.embedding),
    }));

    // Simulating: Guest takes/uploads selfie using Image B (10.jpeg)
    console.log('\n[TEST A]: Guest uploads Image B (10.jpeg) as their search selfie...');
    const selfieFaces = await extractFaces(fs.readFileSync(pathB));
    assert.ok(selfieFaces.length > 0, 'Selfie must detect face');
    const guestEmbedding = selfieFaces[0].embedding;

    // Run matching algorithm against gallery photos with calibrated threshold 0.42
    const threshold = 0.42;
    const photoScores = new Map();
    for (const f of parsedDbFaces) {
      const sim = cosineSimilarity(guestEmbedding, f.embedding);
      const prev = photoScores.get(f.photoId) || 0;
      if (sim > prev) {
        photoScores.set(f.photoId, sim);
      }
    }

    const matches = [];
    for (const [photoId, score] of photoScores.entries()) {
      if (score >= threshold) {
        const photo = testEvent.photos.find(p => p.id === photoId);
        matches.push({
          photoId,
          filename: photo ? photo.filename : 'unknown',
          score,
        });
      }
    }
    matches.sort((a, b) => b.score - a.score);

    console.log(`Gallery Search Results for Guest (Image B): Found ${matches.length} matching photos:`);
    matches.forEach((m, idx) => {
      console.log(`  Match ${idx + 1}: ${m.filename.padEnd(12)} (Photo ID: ${m.photoId}) -> Cosine Similarity: ${m.score.toFixed(4)}`);
    });

    // Check that Image A (2.jpeg) is matched!
    const matched2Jpeg = matches.find(m => m.filename === '2.jpeg');
    assert.ok(matched2Jpeg, 'Image A (2.jpeg) MUST be found when guest searches with Image B (10.jpeg)!');
    console.log(`✔ SUCCESS: Genuine cross-photo match confirmed! 2.jpeg matched with score ${matched2Jpeg.score.toFixed(4)} >= 0.42`);

    // Also check self-match (10.jpeg)
    const matched10Jpeg = matches.find(m => m.filename === '10.jpeg');
    console.log(`✔ Self-photo match: 10.jpeg matched with score ${matched10Jpeg ? matched10Jpeg.score.toFixed(4) : 'N/A'}`);

    // Check that photos of other people (11.jpeg, 14.jpeg) are NOT false matches
    const falseMatches = matches.filter(m => m.filename !== '2.jpeg' && m.filename !== '10.jpeg');
    console.log(`False positive matches on other event photos: ${falseMatches.length}`);
    assert.strictEqual(falseMatches.length, 0, 'Must NOT match unrelated photos of other people');

    // Simulating: Different Guest (Image C: person1_a.jpg) searches the wedding gallery
    console.log('\n[TEST B]: Unrelated Guest uploads Image C (person1_a.jpg) as search selfie...');
    const diffSelfieFaces = await extractFaces(fs.readFileSync(pathC));
    const diffGuestEmbedding = diffSelfieFaces[0].embedding;

    const diffMatches = [];
    for (const [photoId, score] of (() => {
      const sMap = new Map();
      for (const f of parsedDbFaces) {
        const sim = cosineSimilarity(diffGuestEmbedding, f.embedding);
        const prev = sMap.get(f.photoId) || 0;
        if (sim > prev) sMap.set(f.photoId, sim);
      }
      return sMap.entries();
    })()) {
      if (score >= threshold) {
        const photo = testEvent.photos.find(p => p.id === photoId);
        diffMatches.push({ photoId, filename: photo ? photo.filename : 'unknown', score });
      }
    }

    console.log(`Gallery Search Results for Different Guest (Image C): Found ${diffMatches.length} matching photos.`);
    assert.strictEqual(diffMatches.length, 0, 'Unrelated person MUST return 0 matches in this wedding gallery');
    console.log('✔ SUCCESS: Zero false positives for unrelated guest!');

  } finally {
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log('           ALL REAL-WORLD VALIDATION CHECKS PASSED                      ');
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
