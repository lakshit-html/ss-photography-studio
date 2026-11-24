import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { StorageService } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Support finding by either ID or Slug
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        photos: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            filename: true,
            originalUrl: true,
            previewUrl: true,
            thumbnailUrl: true,
            fileSize: true,
            width: true,
            height: true,
            faceCount: true,
            source: true,
            createdAt: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...event,
      usedStorageBytes: Number(event.usedStorageBytes),
    });
  } catch (err: any) {
    console.error('Fetch event detail error:', err);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();

    const updated = await prisma.event.update({
      where: { id },
      data: {
        title: body.title,
        brideName: body.brideName,
        groomName: body.groomName,
        eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
        location: body.location,
        coverPhoto: body.coverPhoto,
        description: body.description,
        isPublic: body.isPublic !== undefined ? body.isPublic : undefined,
        status: body.status,
        allowGuestDownloads: body.allowGuestDownloads !== undefined ? body.allowGuestDownloads : undefined,
        downloadWatermarkedOnly: body.downloadWatermarkedOnly !== undefined ? body.downloadWatermarkedOnly : undefined,
      },
    });

    return NextResponse.json({
      ...updated,
      usedStorageBytes: Number(updated.usedStorageBytes),
    });
  } catch (err: any) {
    console.error('Update event error:', err);
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: { photos: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Delete photos files from storage
    for (const photo of event.photos) {
      await StorageService.deleteFile(photo.originalUrl);
      await StorageService.deleteFile(photo.previewUrl);
      await StorageService.deleteFile(photo.thumbnailUrl);
    }

    await prisma.event.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete event error:', err);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
