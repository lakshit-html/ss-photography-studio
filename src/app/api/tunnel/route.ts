import { NextRequest, NextResponse } from 'next/server';
import { getHostConfig, saveHostConfig, getLocalIPv4 } from '@/lib/tunnel';
import { requireAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const config = getHostConfig();
    return NextResponse.json({
      ...config,
      detectedLanIp: getLocalIPv4(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: Admin authentication required' }, { status: 401 });
    }

    const { activeUrl, mode = 'CUSTOM' } = await req.json();

    if (!activeUrl || typeof activeUrl !== 'string') {
      return NextResponse.json({ error: 'Valid active URL is required' }, { status: 400 });
    }

    const updated = saveHostConfig(activeUrl, mode);

    return NextResponse.json({
      success: true,
      config: updated,
      message: `Active guest host updated to: ${updated.activeUrl}. All QR codes now point here!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
