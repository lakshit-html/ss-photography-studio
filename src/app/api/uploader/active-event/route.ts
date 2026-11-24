import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CONFIG_PATH = path.resolve(process.cwd(), 'uploader/active-event.json');

export async function GET() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(await fs.promises.readFile(CONFIG_PATH, 'utf8'));
      return NextResponse.json(data);
    }

    // Default to latest active event
    const latest = await prisma.event.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { eventDate: 'desc' },
    });

    return NextResponse.json({
      eventId: latest?.id || '',
      eventTitle: latest?.title || 'No Active Event',
      slug: latest?.slug || '',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await req.json();
    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const payload = {
      eventId: event.id,
      eventTitle: event.title,
      slug: event.slug,
      updatedAt: new Date().toISOString(),
    };

    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await fs.promises.writeFile(CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf8');

    return NextResponse.json({ success: true, activeEvent: payload });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
