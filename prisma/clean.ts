import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[CLEAN] Removing all test/fake data...');
  await prisma.faceEmbedding.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.ingestionLog.deleteMany();
  await prisma.event.deleteMany();

  // Ensure default Admin and Watermark settings are initialized with no dummy events
  const adminPassword = 'Admin@123456';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  await prisma.adminUser.upsert({
    where: { email: 'admin@ssphotography.com' },
    update: { passwordHash },
    create: {
      id: 'admin_1',
      email: 'admin@ssphotography.com',
      passwordHash,
      name: 'SS Photography Studio',
    },
  });

  await prisma.watermarkSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      opacity: 0.75,
      sizePercentage: 15,
      position: 'BOTTOM_RIGHT',
      applyToAll: true,
      allowOriginalDownload: true,
    },
  });

  console.log('[CLEAN] Database is now 100% clean. Ready for real photographer events.');
}

main().finally(() => prisma.$disconnect());
