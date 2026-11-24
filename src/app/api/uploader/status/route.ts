import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// In-memory daemon state store
interface UploaderState {
  isRunning: boolean;
  lastHeartbeat: string;
  activeEventId: string;
  activeEventTitle: string;
  tetherDir: string;
  detectedCount: number;
  uploadedCount: number;
  pendingCount: number;
  failedCount: number;
  lastUploadedFile: string | null;
  lastUploadedAt: string | null;
  recentLogs: string[];
}

let globalUploaderState: UploaderState = {
  isRunning: false,
  lastHeartbeat: new Date(0).toISOString(),
  activeEventId: '',
  activeEventTitle: '',
  tetherDir: 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox',
  detectedCount: 0,
  uploadedCount: 0,
  pendingCount: 0,
  failedCount: 0,
  lastUploadedFile: null,
  lastUploadedAt: null,
  recentLogs: ['Uploader initialized. Waiting for first daemon start.'],
};

export async function GET() {
  const now = Date.now();
  const lastTime = new Date(globalUploaderState.lastHeartbeat).getTime();
  const isAlive = now - lastTime < 15000; // Heartbeat within 15 seconds

  return NextResponse.json({
    ...globalUploaderState,
    isRunning: isAlive,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';
    const authHeader = req.headers.get('x-camera-ingest-key');

    if (authHeader !== validKey) {
      return NextResponse.json({ error: 'Unauthorized daemon key' }, { status: 401 });
    }

    globalUploaderState = {
      ...globalUploaderState,
      ...body,
      isRunning: true,
      lastHeartbeat: new Date().toISOString(),
      recentLogs: Array.isArray(body.recentLogs)
        ? [...body.recentLogs.slice(-10)]
        : globalUploaderState.recentLogs,
    };

    return NextResponse.json({ success: true, acknowledged: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
