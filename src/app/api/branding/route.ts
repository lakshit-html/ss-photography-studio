import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminFromRequest } from '@/lib/auth';
import { StorageService } from '@/lib/storage';

export async function GET() {
  try {
    const settings = await prisma.watermarkSettings.findUnique({
      where: { id: 'default' },
    });
    return NextResponse.json(settings || {});
  } catch (err: any) {
    console.error('Fetch branding error:', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    let logoUrl: string | undefined = undefined;
    let opacity = 0.7;
    let sizePercentage = 15;
    let position = 'BOTTOM_RIGHT';
    let applyToAll = true;
    let allowOriginalDownload = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('logo') as File | null;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const saved = await StorageService.saveFile('branding', 'branding', file.name, buffer);
        logoUrl = saved.url;
      }
      if (formData.get('opacity')) opacity = parseFloat(formData.get('opacity') as string);
      if (formData.get('sizePercentage')) sizePercentage = parseInt(formData.get('sizePercentage') as string, 10);
      if (formData.get('position')) position = formData.get('position') as string;
      if (formData.get('applyToAll')) applyToAll = formData.get('applyToAll') === 'true';
      if (formData.get('allowOriginalDownload')) allowOriginalDownload = formData.get('allowOriginalDownload') === 'true';
    } else {
      const body = await req.json();
      opacity = body.opacity ?? opacity;
      sizePercentage = body.sizePercentage ?? sizePercentage;
      position = body.position ?? position;
      applyToAll = body.applyToAll ?? applyToAll;
      allowOriginalDownload = body.allowOriginalDownload ?? allowOriginalDownload;
      logoUrl = body.logoUrl;
    }

    const updated = await prisma.watermarkSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        opacity,
        sizePercentage,
        position,
        applyToAll,
        allowOriginalDownload,
      },
      create: {
        id: 'default',
        logoUrl,
        opacity,
        sizePercentage,
        position,
        applyToAll,
        allowOriginalDownload,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('Update branding error:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
