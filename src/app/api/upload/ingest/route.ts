import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { StorageService, computeSHA256 } from '@/lib/storage';
import { ImageProcessor } from '@/lib/watermark';
import { FaceRecognitionService } from '@/lib/face-recognition';
import { resolveTargetEvent } from '@/lib/event-resolver';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for high-res photo processing

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via Admin Session OR Camera Ingestion Key
    const admin = await requireAdminFromRequest(req);
    const ingestKeyHeader = req.headers.get('x-camera-ingest-key');
    const validIngestKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';

    const isAuthenticated = !!admin || ingestKeyHeader === validIngestKey;
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or ingest key' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawEventId = formData.get('eventId') as string | null;
    const source = (formData.get('source') as string) || (ingestKeyHeader ? 'CAMERA_TETHER' : 'MANUAL');
    const sourceDevice = (formData.get('sourceDevice') as string) || 'Nikon D750';

    // Optional metadata for direct-to-Google-Drive high-res original uploads (> 3.5 MB)
    const originalDriveFileId = (formData.get('originalDriveFileId') as string) || '';
    const originalSafeFilename = (formData.get('originalSafeFilename') as string) || '';
    const originalSha256 = (formData.get('originalSha256') as string) || '';
    const originalFilenameOverride = (formData.get('originalFilename') as string) || '';
    const originalFileSizeRaw = Number(formData.get('originalFileSize') || 0);
    const originalWidthRaw = Number(formData.get('originalWidth') || 0);
    const originalHeightRaw = Number(formData.get('originalHeight') || 0);

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // 1. Resolve target event
    const event = await resolveTargetEvent(rawEventId);
    const eventId = event.id;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = originalFilenameOverride || file.name || `DSC_${Date.now()}.jpg`;

    // 2. Duplicate Detection via SHA-256 (prefers true original SHA-256 when provided)
    const sha256 = originalSha256 || computeSHA256(fileBuffer);
    const existingPhoto = await prisma.photo.findFirst({
      where: { eventId, sha256 },
    });

    if (existingPhoto) {
      await prisma.ingestionLog.create({
        data: {
          eventId,
          filename: originalFilename,
          fileSize: originalFileSizeRaw || fileBuffer.length,
          status: 'DUPLICATE',
          errorMessage: 'Skipped: Identical photo already exists in this event',
          sourceDevice,
        },
      });

      return NextResponse.json(
        {
          message: 'Photo already exists (duplicate skipped)',
          photoId: existingPhoto.id,
          duplicate: true,
          photo: {
            id: existingPhoto.id,
            filename: existingPhoto.filename,
            faceCount: existingPhoto.faceCount,
          },
        },
        { status: 200 }
      );
    }

    // 3. Retrieve Watermark Settings
    const watermarkSettings = await prisma.watermarkSettings.findUnique({
      where: { id: 'default' },
    });

    // 4. Generate Images: Original (or reference pre-uploaded Drive original), Watermarked Preview, Thumbnail
    const meta = await ImageProcessor.getMetadata(fileBuffer);
    let originalUrl = '';

    if (originalDriveFileId) {
      const safeOriginalName =
        originalSafeFilename || `${Date.now()}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      originalUrl = `/api/photos/gdrive/${encodeURIComponent(originalDriveFileId)}?event=${eventId}&cat=originals&file=${encodeURIComponent(safeOriginalName)}`;
    } else {
      const originalSaved = await StorageService.saveFile(eventId, 'originals', originalFilename, fileBuffer);
      originalUrl = originalSaved.url;
    }

    const [watermarkedBuffer, thumbnailBuffer] = await Promise.all([
      ImageProcessor.generateWatermarkedPreview(fileBuffer, {
        opacity: watermarkSettings?.opacity || 0.7,
        sizePercentage: watermarkSettings?.sizePercentage || 15,
        position: (watermarkSettings?.position as any) || 'BOTTOM_RIGHT',
      }),
      ImageProcessor.generateThumbnail(fileBuffer, 600),
    ]);

    const [previewSaved, thumbSaved] = await Promise.all([
      StorageService.saveFile(eventId, 'previews', originalFilename, watermarkedBuffer),
      StorageService.saveFile(eventId, 'thumbnails', originalFilename, thumbnailBuffer),
    ]);

    // 5. Detect Faces & Extract 128D Embeddings
    const detectedFaces = await FaceRecognitionService.detectFaces(fileBuffer);

    const trueFileSize = originalFileSizeRaw > 0 ? originalFileSizeRaw : fileBuffer.length;
    const trueWidth = originalWidthRaw > 0 ? originalWidthRaw : meta.width;
    const trueHeight = originalHeightRaw > 0 ? originalHeightRaw : meta.height;

    // 6. Save Photo in Database
    const photo = await prisma.photo.create({
      data: {
        eventId,
        filename: originalFilename,
        originalUrl,
        previewUrl: previewSaved.url,
        thumbnailUrl: thumbSaved.url,
        fileSize: trueFileSize,
        width: trueWidth,
        height: trueHeight,
        format: meta.format,
        sha256,
        source,
        faceCount: detectedFaces.length,
      },
    });

    // 7. Save Face Embeddings
    if (detectedFaces.length > 0) {
      await prisma.faceEmbedding.createMany({
        data: detectedFaces.map((f) => ({
          photoId: photo.id,
          eventId,
          boundingBox: JSON.stringify(f.boundingBox),
          embedding: JSON.stringify(f.embedding),
          externalFaceId: f.externalFaceId,
          confidence: f.confidence,
        })),
      });
    }

    // 8. Update Event storage bytes
    const totalAddedBytes = trueFileSize + watermarkedBuffer.length + thumbnailBuffer.length;
    await prisma.event.update({
      where: { id: eventId },
      data: {
        usedStorageBytes: {
          increment: BigInt(totalAddedBytes),
        },
      },
    });

    // 9. Log Ingestion
    await prisma.ingestionLog.create({
      data: {
        eventId,
        filename: originalFilename,
        fileSize: trueFileSize,
        status: 'SUCCESS',
        sourceDevice,
      },
    });

    return NextResponse.json({
      success: true,
      photo: {
        id: photo.id,
        filename: photo.filename,
        previewUrl: photo.previewUrl,
        thumbnailUrl: photo.thumbnailUrl,
        faceCount: detectedFaces.length,
      },
      eventId,
      eventTitle: event.title,
    });
  } catch (err: any) {
    console.error('Ingestion pipeline error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to ingest photograph' },
      { status: 500 }
    );
  }
}
