import QRCode from 'qrcode';

export interface QROptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export class QRCodeService {
  /**
   * Generates Data URL (PNG base64) for display and download
   */
  public static async generateDataUrl(
    url: string,
    options: QROptions = {}
  ): Promise<string> {
    return QRCode.toDataURL(url, {
      width: options.width || 400,
      margin: options.margin || 2,
      color: {
        dark: options.color?.dark || '#1A1918', // Deep Charcoal
        light: options.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Generates clean SVG string for high-res vector printing
   */
  public static async generateSvg(
    url: string,
    options: QROptions = {}
  ): Promise<string> {
    return QRCode.toString(url, {
      type: 'svg',
      width: options.width || 400,
      margin: options.margin || 2,
      color: {
        dark: options.color?.dark || '#1A1918',
        light: options.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  }

  /**
   * Generates an elegant, printable A4/Easel Wedding QR Poster (SVG)
   * Designed for luxury wedding table easels and guest entry boards
   */
  public static async generatePrintablePosterSvg(
    eventTitle: string,
    eventDateFormatted: string,
    venue: string,
    eventUrl: string
  ): Promise<string> {
    const qrSvg = await this.generateSvg(eventUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#111111', light: '#FFFFFF' },
    });

    // Strip svg wrapper tags from QR SVG so it can be nested cleanly
    const innerQr = qrSvg
      .replace(/<svg[^>]*>/, '')
      .replace('</svg>', '');

    return `
      <svg width="800" height="1130" viewBox="0 0 800 1130" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&amp;family=Plus+Jakarta+Sans:wght@300;400;600&amp;display=swap');
            .title { font-family: 'Playfair Display', Georgia, serif; font-size: 38px; fill: #111111; text-anchor: middle; font-weight: 700; letter-spacing: 2px; }
            .couple { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; fill: #B88E56; text-anchor: middle; font-style: italic; }
            .date-venue { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; fill: #666666; text-anchor: middle; letter-spacing: 3px; font-weight: 400; text-transform: uppercase; }
            .instruction-header { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; fill: #111111; text-anchor: middle; font-weight: 600; letter-spacing: 1px; }
            .instruction-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; fill: #555555; text-anchor: middle; letter-spacing: 1px; line-height: 20px; }
            .brand-logo { font-family: 'Playfair Display', Georgia, serif; font-size: 16px; fill: #111111; text-anchor: middle; letter-spacing: 6px; font-weight: 600; }
            .brand-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; fill: #B88E56; text-anchor: middle; letter-spacing: 4px; font-weight: 600; text-transform: uppercase; }
          </style>
          <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" flood-opacity="0.08"/>
          </filter>
        </defs>

        <!-- Background -->
        <rect width="800" height="1130" fill="#FAF8F5"/>
        <rect x="30" y="30" width="740" height="1070" fill="none" stroke="#E5DEC9" stroke-width="1.5"/>
        <rect x="40" y="40" width="720" height="1050" fill="none" stroke="#E5DEC9" stroke-width="0.75" stroke-dasharray="4 2"/>

        <!-- Header Branding -->
        <text x="400" y="100" class="brand-logo">SS PHOTOGRAPHY</text>
        <text x="400" y="120" class="brand-sub">LUXURY WEDDING MEMORIES</text>
        <line x1="360" y1="135" x2="440" y2="135" stroke="#B88E56" stroke-width="1.5"/>

        <!-- Wedding Event Title -->
        <text x="400" y="240" class="title">${eventTitle.toUpperCase()}</text>
        <text x="400" y="280" class="date-venue">${eventDateFormatted} • ${venue.toUpperCase()}</text>

        <!-- QR Code Container Card -->
        <g filter="url(#shadow)">
          <rect x="220" y="350" width="360" height="360" rx="12" fill="#FFFFFF"/>
        </g>

        <!-- Embedded QR Code -->
        <g transform="translate(240, 370)">
          ${innerQr}
        </g>

        <!-- Instructions -->
        <text x="400" y="780" class="instruction-header">Find Your Wedding Photos</text>
        <text x="400" y="815" class="instruction-sub">1. Scan this QR code with your smartphone camera</text>
        <text x="400" y="840" class="instruction-sub">2. Take a quick selfie on the gallery page</text>
        <text x="400" y="865" class="instruction-sub">3. AI will instantly discover all your photographs!</text>

        <!-- Bottom Ornament & Note -->
        <line x1="280" y1="940" x2="520" y2="940" stroke="#E5DEC9" stroke-width="1"/>
        <text x="400" y="990" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" fill="#888888" text-anchor: middle; letter-spacing="1.5">
          POWERED BY SS PHOTOGRAPHY SMART AI INGESTION
        </text>
      </svg>
    `;
  }
}
