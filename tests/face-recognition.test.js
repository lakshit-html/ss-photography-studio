import test from 'node:test';
import assert from 'node:assert';
import { cosineSimilarity, euclideanDistance, FaceRecognitionService } from '../src/lib/face-recognition.ts';

test('Face Recognition: cosineSimilarity', () => {
  const vecA = [1, 0, 0, 0];
  const vecB = [1, 0, 0, 0];
  const simIdentical = cosineSimilarity(vecA, vecB);
  assert.strictEqual(Math.round(simIdentical), 1);

  const vecOrthogonal = [0, 1, 0, 0];
  const simOrthogonal = cosineSimilarity(vecA, vecOrthogonal);
  assert.strictEqual(simOrthogonal, 0);

  const vecOpposite = [-1, 0, 0, 0];
  const simOpposite = cosineSimilarity(vecA, vecOpposite);
  assert.strictEqual(Math.round(simOpposite), -1);
});

test('Face Recognition: euclideanDistance', () => {
  const vecA = [0, 0];
  const vecB = [3, 4];
  const dist = euclideanDistance(vecA, vecB);
  assert.strictEqual(dist, 5);
});

test('Face Recognition: matchGuestSelfie ranking and threshold filter', () => {
  const selfie = [1, 0, 0, 0];
  const eventFaces = [
    { photoId: 'photo_high_match', embedding: [0.95, 0.05, 0, 0] },
    { photoId: 'photo_medium_match', embedding: [0.70, 0.30, 0, 0] },
    { photoId: 'photo_low_match', embedding: [0.20, 0.80, 0, 0] },
  ];

  const matches = FaceRecognitionService.matchGuestSelfie(selfie, eventFaces, 0.65);

  assert.strictEqual(matches.length, 2);
  assert.strictEqual(matches[0].photoId, 'photo_high_match');
  assert.strictEqual(matches[1].photoId, 'photo_medium_match');
  assert.ok(matches[0].score > matches[1].score);
});
