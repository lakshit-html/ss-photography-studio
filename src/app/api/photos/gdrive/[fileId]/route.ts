import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { GoogleDriveAdapter } from '@/lib/gdrive';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;
    const eventId = req.nextUrl.searchParams.get('event');
    const category = req.nextUrl.searchParams.get('cat') || 'previews';
    const filename = req.nextUrl.searchParams.get('file');

    if (!fileId || !eventId) {
      return NextResponse.json({ error: 'Missing fileId or event parameter' }, { status: 400 });
    }

    const sanitizedEventId = path.basename(eventId);
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: sanitizedEventId }, { slug: sanitizedEventId }],
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Wedding event not found' }, { status: 404 });
    }

    // 1. Permission Check for Originals
    if (category === 'originals') {
      const admin = await requireAdminFromRequest(req);
      if (!admin) {
        if (!event.allowGuestDownloads) {
          return NextResponse.json(
            { error: 'Original photo downloads are disabled for this event.' },
            { status: 403 }
          );
        }
        if (event.downloadWatermarkedOnly) {
          return NextResponse.json(
            { error: 'High-res original downloads are reserved for studio administrators.' },
            { status: 403 }
          );
        }
      }
    }

    // 2. High-Speed Local Cache Optimization:
    // If the file exists on local SSD, stream directly from disk to save Drive API quotas & bandwidth!
    if (filename) {
      const safeFilename = path.basename(filename);
      const localCandidates = [
        path.resolve(process.cwd(), `public/uploads/${event.id}/${category}/${safeFilename}`),
        path.resolve(process.cwd(), `storage/events/${event.id}/originals/${safeFilename}`),
      ];

      for (const cand of localCandidates) {
        if (fs.existsSync(cand)) {
          const diskBuffer = await fs.promises.readFile(cand);
          return new NextResponse(new Uint8Array(diskBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
              'Content-Disposition': category === 'originals' ? `attachment; filename="${safeFilename}"` : 'inline',
            },
          });
        }
      }
    }

    // 3. Cloud Retrieval: Securely stream from Google Drive via API
    if (GoogleDriveAdapter.isConfigured()) {
      const driveBuffer = await GoogleDriveAdapter.downloadFile(fileId);
      return new NextResponse(new Uint8Array(driveBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Content-Disposition': category === 'originals' ? `attachment; filename="${filename || fileId + '.jpg'}"` : 'inline',
        },
      });
    }

    return NextResponse.json({ error: 'Photo not found in storage' }, { status: 404 });
  } catch (err: any) {
    console.error('Google Drive photo streaming error:', err);
    return NextResponse.json({ error: 'Failed to stream photo from Google Drive' }, { status: 500 });
  }
}
