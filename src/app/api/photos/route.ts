import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { StorageService } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    const eventId = req.nextUrl.searchParams.get('eventId');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);

    const where = eventId ? { eventId } : {};

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          event: {
            select: { id: true, title: true, slug: true, downloadWatermarkedOnly: true, allowGuestDownloads: true },
          },
        },
      }),
      prisma.photo.count({ where }),
    ]);

    // If caller is NOT an admin, strip or mask originalUrl unless event explicitly allows original guest downloads
    const sanitizedPhotos = photos.map((p) => {
      const canAccessOriginal = !!admin || (!p.event.downloadWatermarkedOnly && p.event.allowGuestDownloads);
      return {
        id: p.id,
        filename: p.filename,
        previewUrl: p.previewUrl,
        thumbnailUrl: p.thumbnailUrl,
        originalUrl: canAccessOriginal ? p.originalUrl : null,
        fileSize: p.fileSize,
        width: p.width,
        height: p.height,
        format: p.format,
        faceCount: p.faceCount,
        source: p.source,
        createdAt: p.createdAt,
        event: {
          id: p.event.id,
          title: p.event.title,
          slug: p.event.slug,
        },
      };
    });

    return NextResponse.json({
      photos: sanitizedPhotos,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error('Fetch photos error:', err);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Clean up local/cloud files
    await StorageService.deleteFile(photo.originalUrl);
    await StorageService.deleteFile(photo.previewUrl);
    await StorageService.deleteFile(photo.thumbnailUrl);

    // Decrement event storage usage
    await prisma.event.update({
      where: { id: photo.eventId },
      data: {
        usedStorageBytes: {
          decrement: BigInt(photo.fileSize),
        },
      },
    });

    await prisma.photo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete photo error:', err);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
