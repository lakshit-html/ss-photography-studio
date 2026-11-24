/**
 * SS PHOTOGRAPHY — VAULT & EVENT CLEANUP SCRIPT
 *
 * Empties all test photos, face embeddings, and temporary test events.
 * Leaves the database and storage completely clean and ready for real wedding shoots.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function emptyDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    try {
      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn(`Could not delete ${fullPath}:`, err.message);
    }
  }
}

async function main() {
  console.log('Starting Vault Cleanup...\n');

  // 1. Delete all face embeddings & ingestion logs
  console.log('1. Clearing face embeddings and ingestion logs...');
  const deletedEmbeddings = await prisma.faceEmbedding.deleteMany();
  const deletedLogs = await prisma.ingestionLog.deleteMany();
  console.log(`   Deleted ${deletedEmbeddings.count} face embeddings.`);
  console.log(`   Deleted ${deletedLogs.count} ingestion logs.`);

  // 2. Delete all photo records
  console.log('2. Clearing all photo records from database...');
  const deletedPhotos = await prisma.photo.deleteMany();
  console.log(`   Deleted ${deletedPhotos.count} photo records.`);

  // 3. Clean up test events
  console.log('3. Removing test and duplicate events...');
  await prisma.event.deleteMany({
    where: {
      OR: [
        { id: 'cmwtndj7m000013os3m7o8b0d' },
        { id: 'cmwth3u6h00002fpxe4u3dr5a' },
        { title: { contains: 'Test' } }
      ]
    }
  });

  // Ensure one clean primary wedding event exists
  let primaryEvent = await prisma.event.findFirst({
    where: { status: 'ACTIVE' }
  });

  if (!primaryEvent) {
    primaryEvent = await prisma.event.create({
      data: {
        title: 'Wedding Celebration',
        slug: 'wedding-celebration',
        clientName: 'Wedding Couple',
        clientEmail: 'client@ssphotography.com',
        status: 'ACTIVE',
        eventDate: new Date(),
        allowGuestUploads: false,
        allowGuestDownloads: true,
        downloadWatermarkedOnly: false,
        maxPhotos: 10000,
        storageQuotaBytes: BigInt(500 * 1024 * 1024 * 1024), // 500GB
        usedStorageBytes: BigInt(0),
      }
    });
    console.log(`   Created clean primary event: "${primaryEvent.title}" (${primaryEvent.id})`);
  } else {
    await prisma.event.update({
      where: { id: primaryEvent.id },
      data: {
        title: 'Wedding Celebration',
        usedStorageBytes: BigInt(0),
        status: 'ACTIVE'
      }
    });
    console.log(`   Reset primary event: "${primaryEvent.title}" (${primaryEvent.id}) with 0 bytes.`);
  }

  // Update active-event.json for camera uploader
  const activeEventJsonPath = path.join(__dirname, '..', 'uploader', 'active-event.json');
  fs.writeFileSync(
    activeEventJsonPath,
    JSON.stringify(
      {
        activeEventId: primaryEvent.id,
        eventTitle: primaryEvent.title,
        lastUpdated: new Date().toISOString()
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`   Updated uploader/active-event.json to target event: ${primaryEvent.id}`);

  // 4. Clean local storage directories
  console.log('4. Emptying local test storage directories...');
  const publicUploads = path.join(__dirname, '..', 'public', 'uploads');
  const privateEvents = path.join(__dirname, '..', 'storage', 'events');
  const tetherInbox = path.join(__dirname, '..', 'tether_inbox');

  emptyDir(publicUploads);
  emptyDir(privateEvents);
  emptyDir(tetherInbox);

  // Re-create event subdirectories for primary event
  fs.mkdirSync(path.join(publicUploads, primaryEvent.id, 'previews'), { recursive: true });
  fs.mkdirSync(path.join(publicUploads, primaryEvent.id, 'thumbnails'), { recursive: true });
  fs.mkdirSync(path.join(privateEvents, primaryEvent.id, 'originals'), { recursive: true });

  console.log('   Emptied public/uploads, storage/events, and tether_inbox.');
  console.log('   Initialized fresh directory structure for active event.');

  console.log('\nVAULT CLEANUP COMPLETE!');
  console.log(`Active Event: "${primaryEvent.title}" (ID: ${primaryEvent.id})`);
  console.log('Photo Vault is now completely empty (0 photos) and ready for fresh wedding photos.');
}

main()
  .catch((e) => {
    console.error('Cleanup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
