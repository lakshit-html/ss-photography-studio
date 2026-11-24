import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { S3StorageAdapter } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const PRIVATE_STORAGE_DIR = process.env.STORAGE_PRIVATE_DIR || './storage/originals';

export async function GET(req: NextRequest) {
  try {
    const eventId = req.nextUrl.searchParams.get('event');
    const filename = req.nextUrl.searchParams.get('file');

    if (!eventId || !filename) {
      return NextResponse.json({ error: 'Missing event or file parameter' }, { status: 400 });
    }

    // Prevent path traversal attacks
    const sanitizedFilename = path.basename(filename);
    const sanitizedEventId = path.basename(eventId);

    const event = await prisma.event.findUnique({
      where: { id: sanitizedEventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 1. Check if user is authenticated admin
    const admin = await requireAdminFromRequest(req);

    // 2. If not admin, check event guest download permissions
    if (!admin) {
      if (!event.allowGuestDownloads) {
        return NextResponse.json(
          { error: 'Photo downloads are currently disabled for this event.' },
          { status: 403 }
        );
      }

      if (event.downloadWatermarkedOnly) {
        return NextResponse.json(
          { error: 'Original un-watermarked downloads are restricted to studio administrators.' },
          { status: 403 }
        );
      }
    }

    // Resolve private file path across primary and fallback storage directories
    const primaryPath = path.resolve(process.cwd(), 'storage/events', sanitizedEventId, 'originals', sanitizedFilename);
    const legacyPath = path.resolve(process.cwd(), 'storage/originals', sanitizedEventId, sanitizedFilename);
    const customPath = path.resolve(process.cwd(), PRIVATE_STORAGE_DIR, sanitizedEventId, sanitizedFilename);

    let filePath = primaryPath;
    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(legacyPath)) filePath = legacyPath;
      else if (fs.existsSync(customPath)) filePath = customPath;
    }

    if (fs.existsSync(filePath)) {
      const fileBuffer = await fs.promises.readFile(filePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Fallback: If not on local disk, check DBByte S3 presigned URL
    if (S3StorageAdapter.isConfigured()) {
      const s3Key = `${sanitizedEventId}/originals/${sanitizedFilename}`;
      const signedUrl = await S3StorageAdapter.getSignedDownloadUrl(s3Key, 3600);
      if (signedUrl) {
        return NextResponse.redirect(signedUrl, 302);
      }
    }

    return NextResponse.json({ error: 'Original photo file not found in storage' }, { status: 404 });
  } catch (err: any) {
    console.error('Original photo download error:', err);
    return NextResponse.json({ error: 'Failed to stream photo' }, { status: 500 });
  }
}
