const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Load FaceRecognitionService logic
async function run() {
  const args = process.argv.slice(2);
  const isPreview = args.includes('--preview') || args.includes('--dry-run') || !args.includes('--apply');
  const eventIdArg = args.find((_, i) => args[i - 1] === '--eventId');

  console.log('========================================================================');
  console.log('             SS PHOTOGRAPHY — SAFE PHOTO REINDEXING SYSTEM              ');
  console.log('========================================================================\n');

  if (isPreview) {
    console.log('>>> MODE: PREVIEW / DRY-RUN (No database or photo modifications) <<<');
    console.log('To apply changes, pass: node scripts/reindex-event.cjs --apply --eventId <ID>\n');
  } else {
    console.log('>>> MODE: LIVE REINDEXING (Regenerating 5-point aligned facial embeddings) <<<\n');
  }

  // 1. Resolve Target Events
  let events = [];
  if (eventIdArg) {
    const ev = await prisma.event.findUnique({
      where: { id: eventIdArg },
      include: { _count: { select: { photos: true } } },
    });
    if (!ev) {
      console.error(`Error: Event with ID "${eventIdArg}" not found.`);
      process.exit(1);
    }
    events = [ev];
  } else {
    events = await prisma.event.findMany({
      include: { _count: { select: { photos: true } } },
    });
  }

  console.log(`Found ${events.length} event(s) to evaluate:\n`);
  for (const ev of events) {
    console.log(`Event ID:     ${ev.id}`);
    console.log(`Title:        ${ev.title} (${ev.slug})`);
    console.log(`Total Photos: ${ev._count.photos}`);

    const existingEmbeddingsCount = await prisma.faceEmbedding.count({
      where: { eventId: ev.id },
    });
    console.log(`Current Faces Indexed: ${existingEmbeddingsCount}\n`);

    if (isPreview) {
      console.log(`  [PREVIEW] Photos are ready to be re-indexed with 5-point canonical alignment.`);
      console.log(`  [PREVIEW] Original photos on disk will remain untouched.`);
      console.log(`  [PREVIEW] Storage paths and metadata will remain untouched.\n`);
      continue;
    }

    // Live Reindexing
    const photos = await prisma.photo.findMany({
      where: { eventId: ev.id },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Starting reindexing for ${photos.length} photos in event "${ev.title}"...`);
    let processed = 0;
    let facesGenerated = 0;

    // Load models
    const { FaceRecognitionService } = await import('../src/lib/face-recognition.ts');

    for (const photo of photos) {
      processed++;
      // Locate original file
      let originalFilePath = null;
      const candidates = [
        path.resolve(process.cwd(), `storage/events/${ev.id}/originals/${photo.filename}`),
        path.resolve(process.cwd(), `storage/events/${ev.id}/originals/${photo.originalFilename}`),
        path.resolve(process.cwd(), `public/uploads/${ev.id}/previews/${photo.filename}`),
      ];

      // Check folder for timestamped filenames
      const origDir = path.resolve(process.cwd(), `storage/events/${ev.id}/originals`);
      if (fs.existsSync(origDir)) {
        const files = fs.readdirSync(origDir);
        const match = files.find(f => {
          if (f === photo.filename || f.endsWith('_' + photo.filename)) return true;
          if (photo.originalFilename && (f === photo.originalFilename || f.endsWith('_' + photo.originalFilename))) return true;
          return false;
        });
        if (match) originalFilePath = path.join(origDir, match);
      }

      if (!originalFilePath) {
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            originalFilePath = c;
            break;
          }
        }
      }

      if (!originalFilePath || !fs.existsSync(originalFilePath)) {
        console.warn(`  [${processed}/${photos.length}] Photo ID ${photo.id} (${photo.filename}): Original file not found on local disk, skipping.`);
        continue;
      }

      try {
        const fileBuffer = fs.readFileSync(originalFilePath);
        const detectedFaces = await FaceRecognitionService.detectFaces(fileBuffer);

        // Atomic transaction: replace embeddings for this photo and update photo faceCount
        await prisma.$transaction([
          prisma.faceEmbedding.deleteMany({
            where: { photoId: photo.id },
          }),
          ...(detectedFaces.length > 0
            ? [
                prisma.faceEmbedding.createMany({
                  data: detectedFaces.map((f) => ({
                    photoId: photo.id,
                    eventId: ev.id,
                    boundingBox: JSON.stringify(f.boundingBox),
                    embedding: JSON.stringify(f.embedding),
                    confidence: f.confidence,
                  })),
                }),
              ]
            : []),
          prisma.photo.update({
            where: { id: photo.id },
            data: { faceCount: detectedFaces.length },
          }),
        ]);

        facesGenerated += detectedFaces.length;
        console.log(`  [${processed}/${photos.length}] Photo ${photo.filename}: ${detectedFaces.length} face(s) indexed.`);
      } catch (err) {
        console.error(`  [${processed}/${photos.length}] Error processing photo ${photo.id}:`, err.message);
      }
    }

    console.log(`\nReindexing complete for event "${ev.title}". Total faces indexed: ${facesGenerated}\n`);
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Reindexing fatal error:', err);
  process.exit(1);
});
