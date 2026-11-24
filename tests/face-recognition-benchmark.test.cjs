const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ort = require('onnxruntime-node');

// 5 canonical landmark destination points for 112x112 SFace
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
    float32[0 * total + i] = rawRgb[i * 3 + 2];
    float32[1 * total + i] = rawRgb[i * 3 + 1];
    float32[2 * total + i] = rawRgb[i * 3 + 0];
  }

  return { tensorData: float32, rotatedBuffer, origW, origH, scale, padX, padY };
}

async function runBenchmark() {
  console.log('========================================================================');
  console.log('   SS PHOTOGRAPHY — EVIDENCE-BACKED FACE RECOGNITION BENCHMARK          ');
  console.log('========================================================================\n');

  const modelsDir = path.resolve(process.cwd(), 'models');
  const yunetSession = await ort.InferenceSession.create(path.join(modelsDir, 'face_detection_yunet.onnx'));
  const sfaceSession = await ort.InferenceSession.create(path.join(modelsDir, 'face_recognition_sface.onnx'));

  async function detectAndExtract(imgBuffer, confThreshold = 0.5) {
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

  // Load Test Images
  const imgABuf = fs.readFileSync('tether_inbox/2.jpeg');
  const imgBBuf = fs.readFileSync('tether_inbox/10.jpeg');
  const p1Buf = fs.readFileSync('tests/fixtures/person1_a.jpg');
  const p2Buf = fs.readFileSync('tests/fixtures/person2.jpg');
  const groupBuf = fs.readFileSync('node_modules/@vladmandic/face-api/demo/sample5.jpg');
  const s1Buf = fs.readFileSync('node_modules/@vladmandic/face-api/demo/sample1.jpg');
  const s2Buf = fs.readFileSync('node_modules/@vladmandic/face-api/demo/sample2.jpg');
  const sceneryBuf = fs.readFileSync('tests/fixtures/scenery_noface.jpg');
  const p14Buf = fs.readFileSync('tether_inbox/14.jpeg');

  const [faceA] = await detectAndExtract(imgABuf);
  const [faceB] = await detectAndExtract(imgBBuf);
  const [faceP1] = await detectAndExtract(p1Buf);
  const [faceP2] = await detectAndExtract(p2Buf);

  assert.ok(faceA && faceA.embedding, 'Image A (2.jpeg) must detect face and extract embedding');
  assert.ok(faceB && faceB.embedding, 'Image B (10.jpeg) must detect face and extract embedding');
  assert.ok(faceP1 && faceP1.embedding, 'Person 1 (person1_a.jpg) must detect face and extract embedding');
  assert.ok(faceP2 && faceP2.embedding, 'Person 2 (person2.jpg) must detect face and extract embedding');

  const MATCH_THRESHOLD = 0.42;
  const samePersonScores = [];
  const diffPersonScores = [];
  const benchmarkResults = [];

  function record(section, name, sim, isSamePerson, minSim = null, maxSim = null) {
    let passed = false;
    if (isSamePerson) {
      passed = sim >= (minSim !== null ? minSim : MATCH_THRESHOLD);
      samePersonScores.push(sim);
    } else {
      passed = sim < (maxSim !== null ? maxSim : MATCH_THRESHOLD);
      diffPersonScores.push(sim);
    }
    const mark = passed ? '✔ PASS' : '✘ FAIL';
    console.log(`[${mark}] ${section.padEnd(30)} | ${name.padEnd(52)} | Sim: ${sim.toFixed(4)}`);
    benchmarkResults.push({ section, name, sim, passed, isSamePerson });
    assert.ok(passed, `Benchmark assertion failed for: ${name} (Sim: ${sim.toFixed(4)})`);
  }

  console.log('--- PART 1: GENUINE CROSS-PHOTO IDENTITY TESTS (Independently Captured) ---');
  record('[Real Cross-Photo Identity Test]', 'Image A (2.jpeg) vs Image B (10.jpeg) of SAME Person', cosineSimilarity(faceA.embedding, faceB.embedding), true, MATCH_THRESHOLD);
  
  // Multi-shot cross-capture in demo group wedding photos (sample1 vs sample2)
  const s1Faces = await detectAndExtract(s1Buf, 0.55);
  const s2Faces = await detectAndExtract(s2Buf, 0.55);
  const crossShotSim = cosineSimilarity(s1Faces[2].embedding, s2Faces[1].embedding);
  record('[Real Cross-Photo Identity Test]', 'Independent Cross-Shot Match (sample1 F2 vs sample2 F1)', crossShotSim, true, MATCH_THRESHOLD);

  // Exact reference self-match
  record('[Exact Reference Identity]', 'Image A self-comparison (A vs A)', cosineSimilarity(faceA.embedding, faceA.embedding), true, 0.999);

  console.log('\n--- PART 2: FALSE POSITIVE REJECTION (Genuinely Different People) ---');
  record('[False Positive Rejection]', 'Image A (Person X) vs Different Person 1 (person1_a)', cosineSimilarity(faceA.embedding, faceP1.embedding), false, null, 0.30);
  record('[False Positive Rejection]', 'Image A (Person X) vs Different Person 2 (person2)', cosineSimilarity(faceA.embedding, faceP2.embedding), false, null, 0.30);
  record('[False Positive Rejection]', 'Image B (Person X) vs Different Person 1 (person1_a)', cosineSimilarity(faceB.embedding, faceP1.embedding), false, null, 0.30);
  record('[False Positive Rejection]', 'Image B (Person X) vs Different Person 2 (person2)', cosineSimilarity(faceB.embedding, faceP2.embedding), false, null, 0.30);
  record('[False Positive Rejection]', 'Different Person 1 vs Different Person 2', cosineSimilarity(faceP1.embedding, faceP2.embedding), false, null, 0.30);

  console.log('\n--- PART 3: SYNTHETIC IMAGE-PROCESSING INVARIANCE CHECKS ---');
  // Scenario 3.1: Mobile compression + downscale
  const p1_mobile = await sharp(p1Buf).resize(360, 480).jpeg({ quality: 60 }).toBuffer();
  const [fP1_mobile] = await detectAndExtract(p1_mobile);
  record('[Synthetic Invariance Check]', 'Mobile phone compression & downscale (JPEG 60%)', cosineSimilarity(faceP1.embedding, fP1_mobile.embedding), true, MATCH_THRESHOLD);

  // Scenario 3.2: Bright lighting (+25%)
  const p1_bright = await sharp(p1Buf).modulate({ brightness: 1.25, saturation: 0.9 }).toBuffer();
  const [fP1_bright] = await detectAndExtract(p1_bright);
  record('[Synthetic Invariance Check]', 'Overexposed lighting (+25% brightness)', cosineSimilarity(faceP1.embedding, fP1_bright.embedding), true, MATCH_THRESHOLD);

  // Scenario 3.3: Dark lighting (-25%)
  const p1_dark = await sharp(p1Buf).modulate({ brightness: 0.75, saturation: 1.1 }).toBuffer();
  const [fP1_dark] = await detectAndExtract(p1_dark);
  record('[Synthetic Invariance Check]', 'Underexposed lighting (-25% brightness)', cosineSimilarity(faceP1.embedding, fP1_dark.embedding), true, MATCH_THRESHOLD);

  // Scenario 3.4: Head tilt (8 degrees)
  const p1_rot = await sharp(p1Buf).rotate(8, { background: { r: 128, g: 128, b: 128, alpha: 1 } }).toBuffer();
  const [fP1_rot] = await detectAndExtract(p1_rot);
  record('[Synthetic Invariance Check]', 'Head pose rotation (8 degrees tilt)', cosineSimilarity(faceP1.embedding, fP1_rot.embedding), true, MATCH_THRESHOLD);

  // Scenario 3.5: Crop / Camera zoom
  const metaP1 = await sharp(p1Buf).metadata();
  const p1_crop = await sharp(p1Buf).extract({ left: 60, top: 60, width: metaP1.width - 120, height: metaP1.height - 120 }).toBuffer();
  const [fP1_crop] = await detectAndExtract(p1_crop);
  record('[Synthetic Invariance Check]', 'Camera distance crop (tight portrait crop)', cosineSimilarity(faceP1.embedding, fP1_crop.embedding), true, MATCH_THRESHOLD);

  // Scenario 3.6: Color grade shift
  const p1_makeup = await sharp(p1Buf).tint({ r: 255, g: 235, b: 230 }).modulate({ brightness: 1.05, saturation: 1.15 }).toBuffer();
  const [fP1_makeup] = await detectAndExtract(p1_makeup);
  record('[Synthetic Invariance Check]', 'Warm color grading / makeup simulation', cosineSimilarity(faceP1.embedding, fP1_makeup.embedding), true, MATCH_THRESHOLD);

  console.log('\n--- PART 4: REAL MULTI-FACE DETECTION & BOUNDING BOX CHECKS ---');
  // Group photo multi-face detection (NOT identity comparison)
  const groupFaces = await detectAndExtract(groupBuf, 0.55);
  assert.ok(groupFaces.length >= 4, `Group photo must detect at least 4 faces (found ${groupFaces.length})`);
  console.log(`[✔ PASS] [Face Detection Quality]       | Multi-face group wedding photo       | Detected ${groupFaces.length} faces with valid 5-point landmarks`);

  // Multi-person photo in tether inbox (14.jpeg)
  const p14Faces = await detectAndExtract(p14Buf, 0.55);
  assert.strictEqual(p14Faces.length, 2, `Photo 14.jpeg must detect exactly 2 distinct faces (found ${p14Faces.length})`);
  console.log(`[✔ PASS] [Face Detection Quality]       | Dual-subject wedding photo (14.jpeg) | Detected exactly 2 distinct faces with clean NMS separation`);

  // Scenery photo zero-face detection
  const sceneryFaces = await detectAndExtract(sceneryBuf, 0.50);
  assert.strictEqual(sceneryFaces.length, 0, `Scenery photo must detect 0 faces (found ${sceneryFaces.length})`);
  console.log(`[✔ PASS] [Zero-Face Scenery Detection]  | Venue decor / scenery photo          | Detected 0 faces (0 false positives)`);

  console.log('\n========================================================================');
  console.log('                          BENCHMARK SUMMARY                             ');
  console.log('========================================================================');
  const minSame = Math.min(...samePersonScores);
  const maxDiff = Math.max(...diffPersonScores);
  const margin = minSame - maxDiff;

  console.log(`Total Scenarios:     ${benchmarkResults.length + 3}`);
  console.log(`Passed Scenarios:    ${benchmarkResults.length + 3}`);
  console.log(`Success Rate:        100.0%`);
  console.log(`Calibrated Threshold:          ${MATCH_THRESHOLD}`);
  console.log(`Lowest Same-Person Sim:        ${minSame.toFixed(4)} (Genuine cross-photo: ${cosineSimilarity(faceA.embedding, faceB.embedding).toFixed(4)})`);
  console.log(`Highest Different-Person Sim:  ${maxDiff.toFixed(4)}`);
  console.log(`Separation Margin:             +${margin.toFixed(4)} (Clean discrimination gap)`);
  console.log('========================================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
