import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { GoogleDriveAdapter } from '@/lib/gdrive';
import { resolveTargetEvent } from '@/lib/event-resolver';

export const dynamic = 'force-dynamic';

/**
 * Initiates a direct-to-Google-Drive Resumable Upload session for high-res DSLR files (> 3.5 MB)
 * so original Nikon D750 files bypass Vercel's 4.5 MB serverless body limit completely.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    const ingestKeyHeader = req.headers.get('x-camera-ingest-key');
    const validIngestKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';

    if (!admin && ingestKeyHeader !== validIngestKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { eventId: rawEventId, filename, mimeType, fileSize, sha256 } = body;

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const event = await resolveTargetEvent(rawEventId);

    // Early SHA-256 duplicate check before uploading multi-megabyte original to Drive
    if (sha256) {
      const existing = await prisma.photo.findFirst({
        where: { eventId: event.id, sha256 },
        select: { id: true, filename: true, faceCount: true },
      });
      if (existing) {
        return NextResponse.json({
          duplicate: true,
          photoId: existing.id,
          photo: existing,
          eventId: event.id,
          eventTitle: event.title,
        });
      }
    }

    if (!GoogleDriveAdapter.isConfigured()) {
      return NextResponse.json({
        duplicate: false,
        gdriveConfigured: false,
        eventId: event.id,
        eventTitle: event.title,
      });
    }

    const hierarchy = await GoogleDriveAdapter.ensureEventHierarchy(event.id);
    const origin = req.headers.get('origin') || undefined;
    const { uploadUrl, safeFilename } = await GoogleDriveAdapter.createResumableUploadSession(
      filename,
      hierarchy.originalsFolderId,
      mimeType || 'image/jpeg',
      fileSize ? Number(fileSize) : undefined,
      origin
    );

    return NextResponse.json({
      duplicate: false,
      gdriveConfigured: true,
      uploadUrl,
      safeFilename,
      eventId: event.id,
      eventTitle: event.title,
    });
  } catch (err: any) {
    console.error('GDrive session error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create Google Drive upload session' },
      { status: 500 }
    );
  }
}
