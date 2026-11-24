function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
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

function euclideanDistance(vecA, vecB) {
  if (vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

class FaceRecognitionService {
  static matchGuestSelfie(selfieEmbedding, eventFaceRecords, threshold = 0.42) {
    const scoreMap = new Map();
    for (const record of eventFaceRecords) {
      const similarity = cosineSimilarity(selfieEmbedding, record.embedding);
      if (similarity >= threshold) {
        const existing = scoreMap.get(record.photoId) || 0;
        if (similarity > existing) scoreMap.set(record.photoId, similarity);
      }
    }
    const results = Array.from(scoreMap.entries()).map(([photoId, score]) => ({
      photoId,
      score: Number(score.toFixed(4)),
    }));
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

module.exports = {
  cosineSimilarity,
  euclideanDistance,
  FaceRecognitionService,
};
