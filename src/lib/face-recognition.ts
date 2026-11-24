import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LandmarkPoint {
  x: number;
  y: number;
}

export interface DetectedFace {
  boundingBox: BoundingBox;
  landmarks: LandmarkPoint[]; // 5 facial landmarks: right eye, left eye, nose, right mouth, left mouth
  embedding: number[];         // 128-dimension feature vector from canonical aligned SFace neural network
  confidence: number;
  externalFaceId?: string;
}

export interface MatchResult {
  photoId: string;
  score: number; // 0.0 to 1.0 (cosine similarity)
  confidenceTier?: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Calculates Cosine Similarity between two L2-normalized 128-D vectors.
 * Returns value between -1.0 and 1.0 (1.0 = identical).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculates Euclidean Distance between two vectors.
 */
export function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// 5 canonical landmark destination points for standard 112x112 ArcFace / SFace MobileFaceNet:
// 0: Right Eye, 1: Left Eye, 2: Nose Tip, 3: Right Mouth Corner, 4: Left Mouth Corner
export const CANONICAL_LANDMARKS_112: [number, number][] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/**
 * Computes closed-form 2D Umeyama least-squares similarity transformation matrix:
 * Maps 5 detected source landmarks (x, y) to canonical 112x112 destination coordinates (u, v).
 * Transformation: [u, v]^T = [[a, -b], [b, a]] * [x, y]^T + [c, d]^T
 */
export function getSimilarityTransform(
  srcPts: [number, number][],
  dstPts: [number, number][] = CANONICAL_LANDMARKS_112
): { a: number; b: number; c: number; d: number } | null {
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

/**
 * Warps raw image buffer to a canonical 112x112 BGR Float32Array
 * using inverse similarity transform and high-quality bilinear interpolation.
 */
export function warpAffineBGR(
  rawImg: Buffer | Uint8Array,
  width: number,
  height: number,
  transform: { a: number; b: number; c: number; d: number },
  outSize = 112
): Float32Array | null {
  const { a, b, c, d } = transform;
  const scaleSq = a * a + b * b;
  if (scaleSq === 0) return null;

  const out = new Float32Array(1 * 3 * outSize * outSize);
  const totalPixels = outSize * outSize;

  for (let v = 0; v < outSize; v++) {
    for (let u = 0; u < outSize; u++) {
      const du = u - c;
      const dv = v - d;
      // Inverse mapping to source coordinates
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

        // Source is RGB
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
      out[0 * totalPixels + pIdx] = bVal; // Channel 0 = Blue
      out[1 * totalPixels + pIdx] = gVal; // Channel 1 = Green
      out[2 * totalPixels + pIdx] = rVal; // Channel 2 = Red
    }
  }

  return out;
}

/**
 * Calculates Intersection-over-Union (IoU) for Non-Maximum Suppression (NMS)
 */
function calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  const boxAArea = boxA.width * boxA.height;
  const boxBArea = boxB.width * boxB.height;
  const unionArea = boxAArea + boxBArea - interArea;

  return unionArea === 0 ? 0 : interArea / unionArea;
}

/**
 * Non-Maximum Suppression (NMS) to remove overlapping detections
 */
function applyNMS(
  detections: { box: BoundingBox; landmarks: LandmarkPoint[]; score: number }[],
  iouThreshold = 0.40
): { box: BoundingBox; landmarks: LandmarkPoint[]; score: number }[] {
  detections.sort((a, b) => b.score - a.score);

  const selected: { box: BoundingBox; landmarks: LandmarkPoint[]; score: number }[] = [];

  for (const det of detections) {
    let shouldKeep = true;
    for (const kept of selected) {
      if (calculateIoU(det.box, kept.box) > iouThreshold) {
        shouldKeep = false;
        break;
      }
    }
    if (shouldKeep) {
      selected.push(det);
    }
  }

  return selected;
}

// Global ONNX Runtime Sessions for YuNet (Face Detection) and SFace (Face Recognition)
let yunetSession: ort.InferenceSession | null = null;
let sfaceSession: ort.InferenceSession | null = null;
let initPromise: Promise<void> | null = null;

async function initModels(): Promise<void> {
  if (yunetSession && sfaceSession) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const modelsDir = path.resolve(process.cwd(), 'models');
      const yunetPath = path.join(modelsDir, 'face_detection_yunet.onnx');
      const sfacePath = path.join(modelsDir, 'face_recognition_sface.onnx');

      if (fs.existsSync(yunetPath) && !yunetSession) {
        yunetSession = await ort.InferenceSession.create(yunetPath, {
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
        });
      }

      if (fs.existsSync(sfacePath) && !sfaceSession) {
        sfaceSession = await ort.InferenceSession.create(sfacePath, {
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
        });
      }
    } catch (err) {
      console.error('[FaceRecognition] Model loading error:', err);
    }
  })();

  return initPromise;
}

/**
 * Production Multi-Provider Face Recognition Engine
 * 1. Face Detection: YuNet Deep Neural Network with Letterbox aspect-ratio preservation
 * 2. 5-Point Facial Landmarks: Accurate eye, nose, and mouth keypoints
 * 3. Face Alignment: Canonical 112x112 Umeyama similarity transformation
 * 4. Feature Extraction: SFace Deep Neural Network (128D Unit Hypersphere Vector)
 */
export class FaceRecognitionService {
  /** Calibrated matching threshold for 5-point aligned SFace (Default 0.42) */
  public static readonly DEFAULT_MATCH_THRESHOLD = 0.42;
  public static readonly HIGH_CONFIDENCE_THRESHOLD = 0.55;
  public static readonly LOW_CONFIDENCE_THRESHOLD = 0.36;

  /**
   * Detects all faces in an image buffer, performs canonical 5-point landmark alignment,
   * and extracts SFace 128D embeddings.
   * Accurately handles:
   * - Multiple faces in a wedding group photo
   * - Variable resolutions and aspect ratios (via letterboxing)
   * - Mobile selfies with EXIF orientation
   * - Varied lighting, camera distance, and head pose
   */
  public static async detectFaces(
    imageBuffer: Buffer,
    confThreshold = 0.50
  ): Promise<DetectedFace[]> {
    await initModels();

    if (!yunetSession || !sfaceSession) {
      console.warn('[FaceRecognition] Neural models not initialized, falling back');
      return [];
    }

    try {
      // 1. Auto-orient based on EXIF tag (critical for phone selfies & portrait DSLR shots)
      const rotatedBuffer = await sharp(imageBuffer).rotate().toBuffer();
      const meta = await sharp(rotatedBuffer).metadata();
      const origW = meta.width || 800;
      const origH = meta.height || 600;

      // 2. Prepare 640x640 Letterbox input for YuNet Face Detector (preserves true facial aspect ratio)
      const YUNET_SIZE = 640;
      const scale = Math.min(YUNET_SIZE / origW, YUNET_SIZE / origH);
      const newW = Math.round(origW * scale);
      const newH = Math.round(origH * scale);
      const padX = Math.floor((YUNET_SIZE - newW) / 2);
      const padY = Math.floor((YUNET_SIZE - newH) / 2);

      const { data: rawRgb } = await sharp(rotatedBuffer)
        .resize(newW, newH)
        .extend({
          top: padY,
          bottom: YUNET_SIZE - newH - padY,
          left: padX,
          right: YUNET_SIZE - newW - padX,
          background: { r: 127, g: 127, b: 127 },
        })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const float32 = new Float32Array(1 * 3 * YUNET_SIZE * YUNET_SIZE);
      const totalPixels = YUNET_SIZE * YUNET_SIZE;

      for (let i = 0; i < totalPixels; i++) {
        // YuNet expects BGR channel order
        float32[0 * totalPixels + i] = rawRgb[i * 3 + 2]; // B
        float32[1 * totalPixels + i] = rawRgb[i * 3 + 1]; // G
        float32[2 * totalPixels + i] = rawRgb[i * 3 + 0]; // R
      }

      const inputTensor = new ort.Tensor('float32', float32, [1, 3, YUNET_SIZE, YUNET_SIZE]);
      const out = await yunetSession.run({ input: inputTensor });

      // 3. Decode YuNet Multi-Scale Strides (8, 16, 32)
      const rawCandidates: { box: BoundingBox; landmarks: LandmarkPoint[]; score: number }[] = [];
      const strides = [8, 16, 32];

      for (const s of strides) {
        const cls = out['cls_' + s].data as Float32Array;
        const obj = out['obj_' + s].data as Float32Array;
        const bbox = out['bbox_' + s].data as Float32Array;
        const kps = out['kps_' + s].data as Float32Array;
        const rows = YUNET_SIZE / s;
        const cols = YUNET_SIZE / s;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            const score = Math.sqrt(Math.max(0, cls[idx] * obj[idx]));

            if (score > confThreshold) {
              // YuNet anchor decoding
              const cx = (c + bbox[idx * 4 + 0]) * s;
              const cy = (r + bbox[idx * 4 + 1]) * s;
              const w = Math.exp(bbox[idx * 4 + 2]) * s;
              const h = Math.exp(bbox[idx * 4 + 3]) * s;

              // Un-letterbox back to original image space
              const realCx = (cx - padX) / scale;
              const realCy = (cy - padY) / scale;
              const realW = w / scale;
              const realH = h / scale;

              const realX = Math.max(0, Math.round(realCx - realW / 2));
              const realY = Math.max(0, Math.round(realCy - realH / 2));

              // Decode 5 facial landmarks
              const landmarks: LandmarkPoint[] = [];
              for (let k = 0; k < 5; k++) {
                const lx = (c + kps[idx * 10 + k * 2 + 0]) * s;
                const ly = (r + kps[idx * 10 + k * 2 + 1]) * s;
                landmarks.push({
                  x: (lx - padX) / scale,
                  y: (ly - padY) / scale,
                });
              }

              rawCandidates.push({
                box: {
                  x: realX,
                  y: realY,
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

      // 4. Non-Maximum Suppression (NMS) to eliminate duplicate detections
      const detected = applyNMS(rawCandidates, 0.40);

      if (detected.length === 0) {
        // Scenery, wedding rings, decor with 0 faces
        return [];
      }

      // 5. Extract aligned SFace 128D neural embeddings using Canonical 5-Point Transform
      const { data: rawOrigImg } = await sharp(rotatedBuffer)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const results: DetectedFace[] = [];

      for (const face of detected) {
        try {
          const srcLandmarks: [number, number][] = face.landmarks.map((pt) => [pt.x, pt.y]);
          const transform = getSimilarityTransform(srcLandmarks, CANONICAL_LANDMARKS_112);

          let sfaceInput: Float32Array | null = null;
          if (transform) {
            sfaceInput = warpAffineBGR(rawOrigImg, origW, origH, transform, 112);
          }

          // Fallback if landmark transform failed
          if (!sfaceInput) {
            const marginX = Math.round(face.box.width * 0.15);
            const marginY = Math.round(face.box.height * 0.15);
            const cropX = Math.max(0, face.box.x - marginX);
            const cropY = Math.max(0, face.box.y - marginY);
            const cropW = Math.min(origW - cropX, face.box.width + marginX * 2);
            const cropH = Math.min(origH - cropY, face.box.height + marginY * 2);

            const { data: fallbackCrop } = await sharp(rotatedBuffer)
              .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
              .resize(112, 112, { fit: 'fill' })
              .removeAlpha()
              .raw()
              .toBuffer({ resolveWithObject: true });

            sfaceInput = new Float32Array(1 * 3 * 112 * 112);
            for (let pIdx = 0; pIdx < 112 * 112; pIdx++) {
              sfaceInput[0 * 112 * 112 + pIdx] = fallbackCrop[pIdx * 3 + 2]; // B
              sfaceInput[1 * 112 * 112 + pIdx] = fallbackCrop[pIdx * 3 + 1]; // G
              sfaceInput[2 * 112 * 112 + pIdx] = fallbackCrop[pIdx * 3 + 0]; // R
            }
          }

          const sfaceTensor = new ort.Tensor('float32', sfaceInput, [1, 3, 112, 112]);
          const sfaceOut = await sfaceSession.run({ data: sfaceTensor });

          // SFace output tensor 'fc1' has shape [1, 128]
          const rawVector = Array.from(sfaceOut.fc1.data as Float32Array);

          // L2 Unit-hypersphere normalization for precision cosine similarity
          const norm = Math.sqrt(rawVector.reduce((acc, v) => acc + v * v, 0)) || 1;
          const normalizedEmbedding = rawVector.map((v) => Number((v / norm).toFixed(6)));

          results.push({
            boundingBox: face.box,
            landmarks: face.landmarks,
            embedding: normalizedEmbedding,
            confidence: Number(face.score.toFixed(4)),
          });
        } catch (cropErr) {
          console.error('[FaceRecognition] Face crop/embedding error:', cropErr);
        }
      }

      return results;
    } catch (err) {
      console.error('[FaceRecognition] Detection pipeline error:', err);
      return [];
    }
  }

  /**
   * Matches a guest selfie embedding against all indexed face records for a specific wedding event.
   * Aggregates by photoId using the highest matching face score in each photo.
   * Guarantees strict event isolation.
   */
  public static matchGuestSelfie(
    selfieEmbedding: number[],
    eventFaceRecords: { photoId: string; embedding: number[] }[],
    threshold = FaceRecognitionService.DEFAULT_MATCH_THRESHOLD
  ): MatchResult[] {
    const scoreMap = new Map<string, number>();

    for (const record of eventFaceRecords) {
      const similarity = cosineSimilarity(selfieEmbedding, record.embedding);

      if (similarity >= threshold) {
        const existing = scoreMap.get(record.photoId) || 0;
        if (similarity > existing) {
          scoreMap.set(record.photoId, similarity);
        }
      }
    }

    const results: MatchResult[] = Array.from(scoreMap.entries()).map(([photoId, score]) => {
      let confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (score >= FaceRecognitionService.HIGH_CONFIDENCE_THRESHOLD) {
        confidenceTier = 'HIGH';
      } else if (score >= FaceRecognitionService.DEFAULT_MATCH_THRESHOLD) {
        confidenceTier = 'MEDIUM';
      }

      return {
        photoId,
        score: Number(score.toFixed(4)),
        confidenceTier,
      };
    });

    // Sort descending by highest similarity score
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
