import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FaceRecognitionService } from '@/lib/face-recognition';

export const maxDuration = 30; // 30s max duration

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const eventIdOrSlug = formData.get('eventId') as string | null;
    const selfieFile = formData.get('selfie') as File | null;
    const selfieBase64 = formData.get('selfieBase64') as string | null;
    const customThreshold = formData.get('threshold') as string | null;

    if (!eventIdOrSlug) {
      return NextResponse.json({ error: 'Event identifier is required' }, { status: 400 });
    }

    if (!selfieFile && !selfieBase64) {
      return NextResponse.json({ error: 'Selfie photo is required for face discovery' }, { status: 400 });
    }

    // Resolve event
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: eventIdOrSlug }, { slug: eventIdOrSlug }],
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Wedding event not found' }, { status: 404 });
    }

    // Convert selfie to buffer (in-memory only, strictly privacy compliant)
    let selfieBuffer: Buffer;
    if (selfieFile) {
      selfieBuffer = Buffer.from(await selfieFile.arrayBuffer());
    } else if (selfieBase64) {
      const cleanBase64 = selfieBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      selfieBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      return NextResponse.json({ error: 'Invalid selfie input' }, { status: 400 });
    }

    // 1. Detect Face in Selfie
    const detectedFaces = await FaceRecognitionService.detectFaces(selfieBuffer);
    if (detectedFaces.length === 0) {
      return NextResponse.json(
        {
          error: 'No face detected in the selfie. Please take a clear, well-lit photo looking directly at the camera.',
          matches: [],
          foundCount: 0,
        },
        { status: 422 }
      );
    }

    const primaryFace = detectedFaces[0];
    const selfieEmbedding = primaryFace.embedding;

    // 2. Fetch Face Embeddings for THIS EVENT ONLY (Security & Privacy Isolation)
    const eventFaces = await prisma.faceEmbedding.findMany({
      where: { eventId: event.id },
      select: {
        photoId: true,
        embedding: true,
      },
    });

    if (eventFaces.length === 0) {
      return NextResponse.json({
        message: 'No indexed faces found in this wedding gallery yet.',
        matches: [],
        foundCount: 0,
      });
    }

    // 3. Match against event photos (Calibrated 0.42 threshold for 5-point aligned SFace)
    const threshold = customThreshold
      ? parseFloat(customThreshold)
      : parseFloat(process.env.FACE_MATCHING_THRESHOLD || '0.42');

    const parsedFaces = eventFaces.map((f) => ({
      photoId: f.photoId,
      embedding: JSON.parse(f.embedding) as number[],
    }));

    const matchResults = FaceRecognitionService.matchGuestSelfie(
      selfieEmbedding,
      parsedFaces,
      threshold
    );

    if (matchResults.length === 0) {
      return NextResponse.json({
        message: 'No matching photos found in this wedding. Check back soon as more photos are ingested!',
        matches: [],
        foundCount: 0,
      });
    }

    // 4. Fetch the matched photos from DB
    const matchedPhotoIds = matchResults.map((m) => m.photoId);
    const scoreMap = new Map(matchResults.map((m) => [m.photoId, m.score]));

    const photos = await prisma.photo.findMany({
      where: {
        id: { in: matchedPhotoIds },
        eventId: event.id, // Double verify event isolation
      },
      select: {
        id: true,
        filename: true,
        previewUrl: true,
        thumbnailUrl: true,
        originalUrl: !event.downloadWatermarkedOnly, // Respect download permission
        fileSize: true,
        width: true,
        height: true,
        createdAt: true,
      },
    });

    // Attach match scores and sort by highest similarity score
    const formattedMatches = photos
      .map((p) => ({
        ...p,
        similarityScore: scoreMap.get(p.id) || 0,
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore);

    return NextResponse.json({
      success: true,
      foundCount: formattedMatches.length,
      matches: formattedMatches,
      allowOriginalDownload: !event.downloadWatermarkedOnly,
      eventTitle: event.title,
    });
  } catch (err: any) {
    console.error('Face match error:', err);
    return NextResponse.json(
      { error: 'An error occurred while matching your face against the gallery.' },
      { status: 500 }
    );
  }
}
