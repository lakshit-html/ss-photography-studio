import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface WatermarkConfig {
  logoPath?: string;
  logoBuffer?: Buffer;
  opacity: number; // 0.1 to 1.0
  sizePercentage: number; // 5 to 30 % of target image width
  position: 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'TOP_RIGHT' | 'TOP_LEFT' | 'CENTER';
}

export class ImageProcessor {
  /**
   * Generates a high quality thumbnail (fast loading for gallery grid)
   */
  public static async generateThumbnail(inputBuffer: Buffer, width = 600): Promise<Buffer> {
    return sharp(inputBuffer)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
  }

  /**
   * Generates watermarked preview photo while preserving original photo untouched
   */
  public static async generateWatermarkedPreview(
    originalBuffer: Buffer,
    config: WatermarkConfig
  ): Promise<Buffer> {
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();

    const imgWidth = metadata.width || 1920;
    const imgHeight = metadata.height || 1080;

    // Resize main preview to max 1920px for web display
    const previewWidth = Math.min(imgWidth, 1920);
    const resizedBase = await sharp(originalBuffer)
      .resize({ width: previewWidth, withoutEnlargement: true })
      .toBuffer();

    const resizedMeta = await sharp(resizedBase).metadata();
    const finalWidth = resizedMeta.width || previewWidth;
    const finalHeight = resizedMeta.height || 1080;

    let watermarkBuffer: Buffer | null = null;

    if (config.logoBuffer) {
      watermarkBuffer = config.logoBuffer;
    } else if (config.logoPath && fs.existsSync(config.logoPath)) {
      watermarkBuffer = await fs.promises.readFile(config.logoPath);
    }

    // If no logo is provided, create a sleek typography luxury watermark
    if (!watermarkBuffer) {
      const svgText = `
        <svg width="400" height="80">
          <style>
            .brand { fill: #FFFFFF; font-family: 'Georgia', serif; font-size: 24px; font-weight: 600; letter-spacing: 4px; }
            .sub { fill: #D4AF37; font-family: sans-serif; font-size: 11px; letter-spacing: 3px; font-weight: 500; }
          </style>
          <text x="20" y="38" class="brand">SS PHOTOGRAPHY</text>
          <text x="22" y="58" class="sub">LUXURY WEDDING MEMORIES</text>
        </svg>
      `;
      watermarkBuffer = Buffer.from(svgText);
    }

    // Calculate watermark target dimensions
    const targetWatermarkWidth = Math.max(120, Math.round((finalWidth * config.sizePercentage) / 100));

    // Process watermark with opacity
    const preparedWatermark = await sharp(watermarkBuffer)
      .resize({ width: targetWatermarkWidth, withoutEnlargement: false })
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(config.opacity * 255)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();

    const wmMeta = await sharp(preparedWatermark).metadata();
    const wmWidth = wmMeta.width || targetWatermarkWidth;
    const wmHeight = wmMeta.height || 60;

    const margin = Math.round(finalWidth * 0.025); // 2.5% margin

    let top = finalHeight - wmHeight - margin;
    let left = finalWidth - wmWidth - margin;

    switch (config.position) {
      case 'BOTTOM_LEFT':
        left = margin;
        top = finalHeight - wmHeight - margin;
        break;
      case 'TOP_RIGHT':
        left = finalWidth - wmWidth - margin;
        top = margin;
        break;
      case 'TOP_LEFT':
        left = margin;
        top = margin;
        break;
      case 'CENTER':
        left = Math.round((finalWidth - wmWidth) / 2);
        top = Math.round((finalHeight - wmHeight) / 2);
        break;
      case 'BOTTOM_RIGHT':
      default:
        left = finalWidth - wmWidth - margin;
        top = finalHeight - wmHeight - margin;
        break;
    }

    return sharp(resizedBase)
      .composite([
        {
          input: preparedWatermark,
          top: Math.max(0, top),
          left: Math.max(0, left),
          blend: 'over',
        },
      ])
      .jpeg({ quality: 86, progressive: true })
      .toBuffer();
  }

  /**
   * Inspects image dimensions and metadata
   */
  public static async getMetadata(buffer: Buffer) {
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format || 'jpeg',
    };
  }
}
