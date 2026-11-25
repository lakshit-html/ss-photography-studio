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

    if (!fileId) {
      return NextResponse.json({ error: 'Missing Google Drive fileId parameter' }, { status: 400 });
    }

    // 1. Optional Permission Check for Originals
    if (category === 'originals' && eventId) {
      const sanitizedEventId = path.basename(eventId);
      const event = await prisma.event.findFirst({
        where: {
          OR: [{ id: sanitizedEventId }, { slug: sanitizedEventId }],
        },
      });

      if (event) {
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
    }

    // 2. High-Speed Local Cache Optimization (When running on venue laptop with local storage)
    if (filename && eventId) {
      const safeFilename = path.basename(filename);
      const localCandidates = [
        path.resolve(process.cwd(), `public/uploads/${eventId}/${category}/${safeFilename}`),
        path.resolve(process.cwd(), `storage/events/${eventId}/originals/${safeFilename}`),
      ];

      for (const cand of localCandidates) {
        if (fs.existsSync(cand)) {
          const diskBuffer = await fs.promises.readFile(cand);
          return new NextResponse(new Uint8Array(diskBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Content-Disposition': category === 'originals' ? `attachment; filename="${safeFilename}"` : 'inline',
            },
          });
        }
      }
    }

    // 3. Cloud Retrieval: Securely stream directly from Google Drive API (supports > 4.5 MB originals cleanly)
    if (GoogleDriveAdapter.isConfigured()) {
      try {
        const driveResponse = await GoogleDriveAdapter.streamFile(fileId);
        const headers: Record<string, string> = {
          'Content-Type': driveResponse.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
          'Content-Disposition':
            category === 'originals' ? `attachment; filename="${filename || fileId + '.jpg'}"` : 'inline',
        };
        const contentLen = driveResponse.headers.get('content-length');
        if (contentLen) headers['Content-Length'] = contentLen;

        return new NextResponse(driveResponse.body, {
          status: 200,
          headers,
        });
      } catch (gdriveErr: any) {
        console.error(`[Google Drive Stream Error] for fileId ${fileId}:`, gdriveErr.message);
        // Fallback: If direct API download encounters an issue, redirect to Google Drive's web viewer or thumbnail
        return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}=s1600`, 307);
      }
    }

    // 4. Fallback if credentials not yet configured
    return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}=s1600`, 307);
  } catch (err: any) {
    console.error('Google Drive photo route error:', err);
    return NextResponse.json({ error: 'Failed to stream photo from Google Drive' }, { status: 500 });
  }
}
