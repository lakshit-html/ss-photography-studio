import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { QRCodeService } from '@/lib/qr';
import { getActiveGuestBaseUrl } from '@/lib/tunnel';

export async function GET(req: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      orderBy: { eventDate: 'desc' },
      include: {
        _count: {
          select: { photos: true },
        },
      },
    });

    // Format BigInt usedStorageBytes safely to number/string
    const formatted = events.map((e) => ({
      ...e,
      usedStorageBytes: Number(e.usedStorageBytes),
      photoCount: e._count.photos,
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error('Fetch events error:', err);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      brideName,
      groomName,
      eventDate,
      location,
      coverPhoto,
      description,
      isPublic = true,
      allowGuestDownloads = true,
      downloadWatermarkedOnly = false,
      maxStorageMB = 10000,
    } = body;

    if (!title || !eventDate) {
      return NextResponse.json({ error: 'Title and event date are required' }, { status: 400 });
    }

    // Generate unique slug
    let baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug || `wedding-${Date.now()}`;
    let counter = 1;
    while (await prisma.event.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // Generate QR Code Data URL pointing to event guest gallery using active public or LAN host
    const appUrl = getActiveGuestBaseUrl();
    const eventUrl = `${appUrl}/event/${slug}`;
    const qrCodeDataUrl = await QRCodeService.generateDataUrl(eventUrl, {
      width: 400,
    });

    const parsedDate = new Date(eventDate);
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const newEvent = await prisma.event.create({
      data: {
        title,
        slug,
        brideName,
        groomName,
        eventDate: validDate,
        location,
        coverPhoto: coverPhoto || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80',
        description,
        isPublic,
        allowGuestDownloads,
        downloadWatermarkedOnly,
        maxStorageMB,
        qrCodeDataUrl,
      },
    });

    return NextResponse.json({
      ...newEvent,
      usedStorageBytes: Number(newEvent.usedStorageBytes),
    }, { status: 201 });
  } catch (err: any) {
    console.error('Create event error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create event' }, { status: 500 });
  }
}
