import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { QRCodeService } from '@/lib/qr';
import { getActiveGuestBaseUrl } from '@/lib/tunnel';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const format = req.nextUrl.searchParams.get('format') || 'png'; // 'png' | 'svg' | 'poster'

    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const appUrl = getActiveGuestBaseUrl();
    const eventUrl = `${appUrl}/event/${event.slug}`;

    if (format === 'poster') {
      const dateStr = new Date(event.eventDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const posterSvg = await QRCodeService.generatePrintablePosterSvg(
        event.title,
        dateStr,
        event.location || 'Wedding Celebration',
        eventUrl
      );

      return new NextResponse(posterSvg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="${event.slug}-wedding-qr-poster.svg"`,
        },
      });
    }

    if (format === 'svg') {
      const svg = await QRCodeService.generateSvg(eventUrl, { width: 500 });
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="${event.slug}-qr.svg"`,
        },
      });
    }

    // Default: Return data URL / base64 PNG
    const dataUrl = await QRCodeService.generateDataUrl(eventUrl, { width: 600 });
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(imgBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${event.slug}-qr.png"`,
      },
    });
  } catch (err: any) {
    console.error('QR download error:', err);
    return NextResponse.json({ error: 'Failed to generate QR' }, { status: 500 });
  }
}
