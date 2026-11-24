const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ort = require('onnxruntime-node');
const assert = require('assert');

// Test the complete YuNet -> Alignment -> SFace pipeline
async function runTest() {
  console.log('=== REAL DEEP NEURAL FACE PIPELINE TEST ===');
  
  const modelsDir = path.resolve(process.cwd(), 'models');
  const yunetPath = path.join(modelsDir, 'face_detection_yunet.onnx');
  const sfacePath = path.join(modelsDir, 'face_recognition_sface.onnx');

  const yunetSession = await ort.InferenceSession.create(yunetPath);
  const sfaceSession = await ort.InferenceSession.create(sfacePath);

  async function detectAndEmbed(imageBuffer) {
    const meta = await sharp(imageBuffer).metadata();
    const origW = meta.width;
    const origH = meta.height;

    // 1. YuNet input 640x640
    const { data: rawRgb } = await sharp(imageBuffer)
      .resize(640, 640, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const float32 = new Float32Array(1 * 3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      float32[0 * 640 * 640 + i] = rawRgb[i * 3 + 2]; // B
      float32[1 * 640 * 640 + i] = rawRgb[i * 3 + 1]; // G
      float32[2 * 640 * 640 + i] = rawRgb[i * 3 + 0]; // R
    }

    const out = await yunetSession.run({ input: new ort.Tensor('float32', float32, [1, 3, 640, 640]) });

    // Decode candidates
    let best = null;
    let maxScore = 0;

    for (const s of [8, 16, 32]) {
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
          if (score > 0.6 && score > maxScore) {
            maxScore = score;
            const cx = (c + 0.5) * s;
            const cy = (r + 0.5) * s;
            const w = Math.exp(bbox[idx * 4 + 2]) * s;
            const h = Math.exp(bbox[idx * 4 + 3]) * s;
            const scaleX = origW / 640;
            const scaleY = origH / 640;

            best = {
              x: Math.max(0, Math.round((cx + bbox[idx * 4 + 0] * s - w / 2) * scaleX)),
              y: Math.max(0, Math.round((cy + bbox[idx * 4 + 1] * s - h / 2) * scaleY)),
              w: Math.round(w * scaleX),
              h: Math.round(h * scaleY),
              rightEye: { x: Math.round((cx + kps[idx * 10 + 0] * s) * scaleX), y: Math.round((cy + kps[idx * 10 + 1] * s) * scaleY) },
              leftEye: { x: Math.round((cx + kps[idx * 10 + 2] * s) * scaleX), y: Math.round((cy + kps[idx * 10 + 3] * s) * scaleY) },
              score,
            };
          }
        }
      }
    }

    if (!best) return null;

    // Face alignment using eye angle
    const dy = best.leftEye.y - best.rightEye.y;
    const dx = best.leftEye.x - best.rightEye.x;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    let pipe = sharp(imageBuffer).extract({
      left: Math.max(0, best.x),
      top: Math.max(0, best.y),
      width: Math.min(origW - best.x, best.w),
      height: Math.min(origH - best.y, best.h),
    });

    if (Math.abs(angle) > 2) {
      pipe = pipe.rotate(-angle, { background: { r: 128, g: 128, b: 128, alpha: 1 } });
    }

    const { data: alignedCrop } = await pipe.resize(112, 112, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    const sfaceIn = new Float32Array(1 * 3 * 112 * 112);
    for (let i = 0; i < 112 * 112; i++) {
      sfaceIn[0 * 112 * 112 + i] = alignedCrop[i * 3 + 2]; // B
      sfaceIn[1 * 112 * 112 + i] = alignedCrop[i * 3 + 1]; // G
      sfaceIn[2 * 112 * 112 + i] = alignedCrop[i * 3 + 0]; // R
    }

    const sfaceOut = await sfaceSession.run({ data: new ort.Tensor('float32', sfaceIn, [1, 3, 112, 112]) });
    const raw = Array.from(sfaceOut.fc1.data);
    const norm = Math.sqrt(raw.reduce((a, b) => a + b * b, 0)) || 1;
    return {
      box: best,
      embedding: raw.map(v => v / norm),
      score: best.score,
    };
  }

  function cosineSim(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
  }

  // 1. Test face detection and alignment on Person 1
  console.log('Test 1: Detecting and embedding Person 1...');
  const img1 = fs.readFileSync('tests/fixtures/person1_a.jpg');
  const res1 = await detectAndEmbed(img1);
  assert.ok(res1 !== null, 'Person 1 must be detected');
  console.log('✔ Person 1 face detected! Confidence:', res1.score.toFixed(4));
  console.log('  Bounding box:', res1.box);
  console.log('  128D embedding length:', res1.embedding.length);

  // 2. Test Person 1 cropped/rotated variation
  console.log('Test 2: Detecting and embedding Person 1 (rotated 10 deg variation)...');
  const img1_rot = await sharp(img1).rotate(10).toBuffer();
  const res1_rot = await detectAndEmbed(img1_rot);
  assert.ok(res1_rot !== null, 'Rotated Person 1 must be detected');
  const simSame = cosineSim(res1.embedding, res1_rot.embedding);
  console.log('✔ Same-person similarity (0 deg vs 10 deg rotated):', simSame.toFixed(4));

  // 3. Test Person 2 (different person)
  console.log('Test 3: Detecting and embedding Person 2...');
  const img2 = fs.readFileSync('tests/fixtures/person2.jpg');
  const res2 = await detectAndEmbed(img2);
  assert.ok(res2 !== null, 'Person 2 must be detected');
  const simDiff = cosineSim(res1.embedding, res2.embedding);
  console.log('✔ Different-person similarity:', simDiff.toFixed(4));

  // 4. Test Scenery (0 faces)
  console.log('Test 4: Scenery/decor photo without human faces...');
  const imgScenery = fs.readFileSync('tests/fixtures/scenery_noface.jpg');
  const resScenery = await detectAndEmbed(imgScenery);
  assert.strictEqual(resScenery, null, 'Scenery photo must detect 0 faces');
  console.log('✔ Zero-face scenery test PASSED (detected: 0 faces).');

  assert.ok(simSame > 0.65, 'Same person similarity must be > 0.65');
  assert.ok(simDiff < 0.45, 'Different person similarity must be < 0.45');
  console.log('\n=== REAL DEEP NEURAL FACE PIPELINE TESTS PASSED (4/4)! ===\n');
}

runTest().catch(err => {
  console.error('Face pipeline test failed:', err);
  process.exit(1);
});
