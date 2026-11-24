import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

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
    const ingestKeyHeader = req.headers.get('x-camera-ingest-key');
    const validIngestKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';

    const isAuthorized = !!admin || (ingestKeyHeader && ingestKeyHeader === validIngestKey);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin or camera key required' }, { status: 401 });
    }

    const body = await req.json();
    const { id, filename, eventId } = body;

    if (!id && !filename) {
      return NextResponse.json({ error: 'Photo ID or filename is required' }, { status: 400 });
    }

    let photosToDelete: any[] = [];

    if (id) {
      const photo = await prisma.photo.findUnique({
        where: { id },
      });
      if (photo) photosToDelete.push(photo);
    } else if (filename) {
      // Resolve event if eventId provided (slug or cuid)
      let resolvedEventId = eventId;
      if (eventId) {
        const ev = await prisma.event.findFirst({
          where: { OR: [{ id: eventId }, { slug: eventId }] },
          select: { id: true },
        });
        if (ev) resolvedEventId = ev.id;
      }

      const whereClause: any = { filename };
      if (resolvedEventId) {
        whereClause.eventId = resolvedEventId;
      }

      photosToDelete = await prisma.photo.findMany({
        where: whereClause,
      });

      // Fallback: check if stored filename ends with the target filename
      if (photosToDelete.length === 0) {
        photosToDelete = await prisma.photo.findMany({
          where: {
            filename: {
              endsWith: filename,
            },
            ...(resolvedEventId ? { eventId: resolvedEventId } : {}),
          },
        });
      }
    }

    if (photosToDelete.length === 0) {
      return NextResponse.json({ error: 'Photo not found', deletedCount: 0 }, { status: 404 });
    }

    let deletedCount = 0;
    const deletedIds: string[] = [];

    for (const photo of photosToDelete) {
      // Clean up files across local disk, S3, and Google Drive
      await StorageService.deleteFile(photo.originalUrl);
      await StorageService.deleteFile(photo.previewUrl);
      await StorageService.deleteFile(photo.thumbnailUrl);

      // Decrement event storage usage
      await prisma.event
        .update({
          where: { id: photo.eventId },
          data: {
            usedStorageBytes: {
              decrement: BigInt(photo.fileSize),
            },
          },
        })
        .catch(() => {});

      // Delete from Prisma (cascades to face embeddings)
      await prisma.photo.delete({
        where: { id: photo.id },
      });

      deletedCount++;
      deletedIds.push(photo.id);
    }

    return NextResponse.json({ success: true, deletedCount, deletedIds });
  } catch (err: any) {
    console.error('Delete photo error:', err);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
