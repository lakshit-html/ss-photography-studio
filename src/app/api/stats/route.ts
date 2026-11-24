import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const [
      eventCount,
      activeEventCount,
      photoCount,
      events,
      recentIngestions,
      totalFaces,
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { status: 'ACTIVE' } }),
      prisma.photo.count(),
      prisma.event.findMany({ select: { usedStorageBytes: true } }),
      prisma.ingestionLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          event: { select: { title: true } },
        },
      }),
      prisma.faceEmbedding.count(),
    ]);

    const totalStorageBytes = events.reduce(
      (acc, e) => acc + Number(e.usedStorageBytes),
      0
    );

    return NextResponse.json({
      events: {
        total: eventCount,
        active: activeEventCount,
      },
      photos: {
        total: photoCount,
        facesIndexed: totalFaces,
      },
      storage: {
        usedBytes: totalStorageBytes,
        usedMB: Number((totalStorageBytes / (1024 * 1024)).toFixed(2)),
        usedGB: Number((totalStorageBytes / (1024 * 1024 * 1024)).toFixed(3)),
      },
      recentIngestions,
    });
  } catch (err: any) {
    console.error('Fetch stats error:', err);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
