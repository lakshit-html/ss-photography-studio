const fs = require('fs');
const path = require('path');

async function test() {
  const { FaceRecognitionService } = await import('../src/lib/face-recognition.ts');
  const buf2 = fs.readFileSync('storage/events/cmwtndj7m000013os3m7o8b0d/originals/1795463863070_2.jpeg');
  const buf10 = fs.readFileSync('storage/events/cmwtndj7m000013os3m7o8b0d/originals/1795463857429_10.jpeg');
  
  const faces2 = await FaceRecognitionService.detectFaces(buf2);
  const faces10 = await FaceRecognitionService.detectFaces(buf10);

  console.log('faces2 count:', faces2.length);
  if (faces2.length > 0) {
    console.log('faces2[0] box:', faces2[0].boundingBox);
    console.log('faces2[0] sample:', faces2[0].embedding.slice(0, 5));
  }

  console.log('faces10 count:', faces10.length);
  if (faces10.length > 0) {
    console.log('faces10[0] box:', faces10[0].boundingBox);
    console.log('faces10[0] sample:', faces10[0].embedding.slice(0, 5));
  }

  if (faces2.length > 0 && faces10.length > 0) {
    const sim = FaceRecognitionService.matchGuestSelfie(
      faces10[0].embedding,
      [{ photoId: 'photo-2', embedding: faces2[0].embedding }],
      0.42
    );
    console.log('Match result:', sim);
  }
}

test().catch(console.error);
