import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { StorageService, computeSHA256 } from '@/lib/storage';
import { ImageProcessor } from '@/lib/watermark';
import { FaceRecognitionService } from '@/lib/face-recognition';

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
    let eventId = formData.get('eventId') as string | null;
    const source = (formData.get('source') as string) || (ingestKeyHeader ? 'CAMERA_TETHER' : 'MANUAL');
    const sourceDevice = (formData.get('sourceDevice') as string) || 'Nikon D750';

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // 1. Resolve target event with bulletproof fallback
    let event = eventId
      ? await prisma.event.findFirst({
          where: {
            OR: [{ id: eventId }, { slug: eventId }],
          },
        })
      : null;

    if (!event) {
      event = await prisma.event.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { eventDate: 'desc' },
      });
    }

    if (!event) {
      event = await prisma.event.findFirst({
        orderBy: { eventDate: 'desc' },
      });
    }

    if (!event) {
      event = await prisma.event.create({
        data: {
          title: 'Wedding Celebration',
          slug: 'reception',
          eventDate: new Date(),
          status: 'ACTIVE',
        },
      });
    }

    eventId = event.id;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalFilename = file.name || `DSC_${Date.now()}.jpg`;

    // 2. Duplicate Detection via SHA-256
    const sha256 = computeSHA256(fileBuffer);
    const existingPhoto = await prisma.photo.findFirst({
      where: { eventId, sha256 },
    });

    if (existingPhoto) {
      await prisma.ingestionLog.create({
        data: {
          eventId,
          filename: originalFilename,
          fileSize: fileBuffer.length,
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
        },
        { status: 200 }
      );
    }

    // 3. Retrieve Watermark Settings
    const watermarkSettings = await prisma.watermarkSettings.findUnique({
      where: { id: 'default' },
    });

    // 4. Generate Images: Original, Watermarked Preview, Thumbnail
    const [originalSaved, meta] = await Promise.all([
      StorageService.saveFile(eventId, 'originals', originalFilename, fileBuffer),
      ImageProcessor.getMetadata(fileBuffer),
    ]);

    const watermarkedBuffer = await ImageProcessor.generateWatermarkedPreview(fileBuffer, {
      opacity: watermarkSettings?.opacity || 0.7,
      sizePercentage: watermarkSettings?.sizePercentage || 15,
      position: (watermarkSettings?.position as any) || 'BOTTOM_RIGHT',
    });

    const thumbnailBuffer = await ImageProcessor.generateThumbnail(fileBuffer, 600);

    const [previewSaved, thumbSaved] = await Promise.all([
      StorageService.saveFile(eventId, 'previews', originalFilename, watermarkedBuffer),
      StorageService.saveFile(eventId, 'thumbnails', originalFilename, thumbnailBuffer),
    ]);

    // 5. Detect Faces & Extract 128D Embeddings
    const detectedFaces = await FaceRecognitionService.detectFaces(fileBuffer);

    // 6. Save Photo in Database
    const photo = await prisma.photo.create({
      data: {
        eventId,
        filename: originalFilename,
        originalUrl: originalSaved.url,
        previewUrl: previewSaved.url,
        thumbnailUrl: thumbSaved.url,
        fileSize: fileBuffer.length,
        width: meta.width,
        height: meta.height,
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
    const totalAddedBytes = fileBuffer.length + watermarkedBuffer.length + thumbnailBuffer.length;
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
        fileSize: fileBuffer.length,
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
