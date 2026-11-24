import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      user: {
        id: 'admin',
        email: 'admin@ssphotography.com',
        name: 'SS Photography Admin',
      },
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: 'open_studio_token',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: true });
  }
}
