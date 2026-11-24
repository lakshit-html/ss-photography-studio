import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import prisma from '@/lib/prisma';
import { GoogleDriveAdapter } from '@/lib/gdrive';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const slugParts = params.slug || [];
    if (slugParts.length === 0) {
      return NextResponse.json({ error: 'File not specified' }, { status: 400 });
    }

    const filename = slugParts[slugParts.length - 1];
    const relPath = slugParts.join('/');

    // 1. Check local public/uploads directory
    const publicPath = path.resolve(process.cwd(), 'public/uploads', relPath);
    if (fs.existsSync(publicPath)) {
      const buffer = await fs.promises.readFile(publicPath);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Check /tmp scratch directory (Vercel serverless environment)
    const tmpPath = path.join(os.tmpdir(), 'ss-photography', 'public_uploads', relPath);
    if (fs.existsSync(tmpPath)) {
      const buffer = await fs.promises.readFile(tmpPath);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 3. Fallback: Search Photo in database to find Google Drive fileId or original
    const photo = await prisma.photo.findFirst({
      where: {
        OR: [
          { filename },
          { previewUrl: { contains: filename } },
          { thumbnailUrl: { contains: filename } },
        ],
      },
      select: {
        id: true,
        originalUrl: true,
        previewUrl: true,
      },
    });

    if (photo) {
      // Check if URL has Google Drive fileId: /api/photos/gdrive/{fileId}
      const match = (photo.previewUrl || photo.originalUrl || '').match(/\/api\/photos\/gdrive\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        const fileId = match[1];
        if (GoogleDriveAdapter.isConfigured()) {
          try {
            const driveBuffer = await GoogleDriveAdapter.downloadFile(fileId);
            return new NextResponse(new Uint8Array(driveBuffer), {
              status: 200,
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, stale-while-revalidate=86400',
              },
            });
          } catch {
            return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}=s1600`, 307);
          }
        }
        return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}=s1600`, 307);
      }
    }

    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  } catch (err: any) {
    console.error('Uploads route error:', err);
    return NextResponse.json({ error: 'Failed to retrieve image' }, { status: 500 });
  }
}
