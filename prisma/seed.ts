import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Seeding database for SS Photography...');

  // 1. Seed Admin User
  const adminPassword = 'Admin@123456';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@ssphotography.com' },
    update: { passwordHash },
    create: {
      id: 'admin_1',
      email: 'admin@ssphotography.com',
      passwordHash,
      name: 'SS Photography Executive Studio',
    },
  });
  console.log(`[SEED] Admin created: ${admin.email} (Password: ${adminPassword})`);

  // 2. Seed Default Watermark Settings
  const watermark = await prisma.watermarkSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      opacity: 0.75,
      sizePercentage: 16,
      position: 'BOTTOM_RIGHT',
      applyToAll: true,
      allowOriginalDownload: true,
    },
  });
  console.log('[SEED] Watermark settings initialized.');

  // 3. Seed Flagship Wedding Event
  const slug = 'aarav-and-ananya-udaipur-2026';
  const qrDataUrl = await QRCode.toDataURL(`http://localhost:3000/event/${slug}`, {
    width: 400,
    margin: 2,
    color: { dark: '#111111', light: '#FFFFFF' },
  });

  const event = await prisma.event.upsert({
    where: { slug },
    update: { qrCodeDataUrl: qrDataUrl },
    create: {
      title: 'The Royal Udaipur Wedding',
      slug,
      brideName: 'Ananya Sharma',
      groomName: 'Aarav Singhania',
      eventDate: new Date('2026-12-18T16:00:00Z'),
      location: 'The Oberoi Udaivilas, Lake Pichola, Udaipur',
      coverPhoto: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80',
      description: 'An enchanting multi-day celebration under Udaipur skies, photographed on Nikon D750.',
      isPublic: true,
      allowGuestDownloads: true,
      downloadWatermarkedOnly: false,
      maxStorageMB: 15000,
      usedStorageBytes: BigInt(45000000),
      qrCodeDataUrl: qrDataUrl,
      status: 'ACTIVE',
    },
  });
  console.log(`[SEED] Event created: ${event.title} (/event/${event.slug})`);

  // 4. Seed High-Resolution Wedding Photos for Event with pre-extracted faces
  const samplePhotos = [
    {
      filename: 'DSC_4821_NikonD750.jpg',
      originalUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80',
      previewUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
      fileSize: 4200000,
      width: 4000,
      height: 2667,
      sha256: 'sha256_mock_photo_1',
      source: 'CAMERA_TETHER',
      faceCount: 2,
    },
    {
      filename: 'DSC_4835_NikonD750.jpg',
      originalUrl: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1600&q=80',
      previewUrl: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1200&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=600&q=80',
      fileSize: 4800000,
      width: 4000,
      height: 2667,
      sha256: 'sha256_mock_photo_2',
      source: 'CAMERA_TETHER',
      faceCount: 1,
    },
    {
      filename: 'DSC_4890_NikonD750.jpg',
      originalUrl: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1600&q=80',
      previewUrl: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=600&q=80',
      fileSize: 3900000,
      width: 4000,
      height: 2667,
      sha256: 'sha256_mock_photo_3',
      source: 'CAMERA_TETHER',
      faceCount: 2,
    },
    {
      filename: 'DSC_4905_NikonD750.jpg',
      originalUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=80',
      previewUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=600&q=80',
      fileSize: 5100000,
      width: 4000,
      height: 2667,
      sha256: 'sha256_mock_photo_4',
      source: 'CAMERA_TETHER',
      faceCount: 3,
    },
  ];

  for (const p of samplePhotos) {
    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        filename: p.filename,
        originalUrl: p.originalUrl,
        previewUrl: p.previewUrl,
        thumbnailUrl: p.thumbnailUrl,
        fileSize: p.fileSize,
        width: p.width,
        height: p.height,
        sha256: p.sha256,
        source: p.source,
        faceCount: p.faceCount,
      },
    });

    // Create 128D embedding vector for face recognition matching
    const dummyEmbedding = Array.from({ length: 128 }, (_, i) =>
      Number((Math.sin(i * 0.2 + p.width * 0.001) * 0.1).toFixed(4))
    );

    await prisma.faceEmbedding.create({
      data: {
        photoId: photo.id,
        eventId: event.id,
        boundingBox: JSON.stringify({ x: 0.25, y: 0.2, width: 0.5, height: 0.5 }),
        embedding: JSON.stringify(dummyEmbedding),
        confidence: 0.98,
      },
    });
  }

  // 5. Seed Ingestion Logs
  await prisma.ingestionLog.create({
    data: {
      eventId: event.id,
      filename: 'DSC_4821_NikonD750.jpg',
      fileSize: 4200000,
      status: 'SUCCESS',
      sourceDevice: 'Nikon D750 (USB Tether)',
    },
  });

  console.log('[SEED] Successfully seeded all data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
