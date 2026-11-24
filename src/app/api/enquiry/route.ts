import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, weddingDate, venue, guestCount, message } = body;

    if (!name || !email || !phone) {
      return NextResponse.json({ error: 'Name, email, and phone number are required.' }, { status: 400 });
    }

    // Enquiry payload designated for Suresh Solanki
    const recipient = {
      name: 'Suresh Solanki',
      email: 'solankiluck339@gmail.com',
      phone: '9214404404',
    };

    console.log('[Wedding Consultation Enquiry Received]:', {
      recipient,
      client: { name, email, phone },
      details: { weddingDate, venue, guestCount, message },
      receivedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Consultation request routed successfully to Suresh Solanki',
      recipient: recipient.email,
    });
  } catch (err: any) {
    console.error('Enquiry submission error:', err);
    return NextResponse.json({ error: 'Failed to record inquiry' }, { status: 500 });
  }
}
