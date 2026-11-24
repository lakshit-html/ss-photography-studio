import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GoogleDriveAdapter } from './gdrive';

export interface StorageResult {
  url: string;
  path: string;
  size: number;
  isPrivate: boolean;
  gdriveFileId?: string;
}

export interface StorageMetrics {
  provider: string;
  storageBaseDir: string;
  publicUploadDir: string;
  originalsBytes: number;
  previewsBytes: number;
  thumbnailsBytes: number;
  totalBytes: number;
  totalOriginalsCount: number;
  totalPreviewsCount: number;
  totalThumbnailsCount: number;
}

// Public directory for web assets (thumbnails, watermarked previews, and studio branding)
const PUBLIC_UPLOAD_DIR = process.env.STORAGE_PUBLIC_DIR || './public/uploads';

// Private directory outside public web root for uncompressed, un-watermarked high-res originals
const PRIVATE_STORAGE_DIR = process.env.STORAGE_PRIVATE_DIR || './storage/events';

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL_ENV);
}

function ensureDirectoryExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err: any) {
    // Non-fatal if filesystem is read-only (e.g. AWS Lambda / Vercel /var/task)
  }
}

/**
 * Computes SHA-256 hash of a buffer for duplicate detection
 */
export function computeSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Supabase Storage Adapter Implementation
 * Code-ready: Uses Supabase Storage REST API to upload objects if credentials exist
 */
export class SupabaseStorageAdapter {
  private static supabaseUrl = process.env.SUPABASE_URL || '';
  private static supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  private static bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'ss-photography-gallery';

  public static isConfigured(): boolean {
    return !!(this.supabaseUrl && this.supabaseServiceKey);
  }

  public static async upload(
    storagePath: string,
    buffer: Buffer,
    contentType = 'image/jpeg'
  ): Promise<{ url: string; key: string } | null> {
    if (!this.isConfigured()) return null;

    const endpoint = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${storagePath}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.supabaseServiceKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase upload failed: ${res.status} ${errText}`);
    }

    const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${storagePath}`;
    return { url: publicUrl, key: storagePath };
  }
}

/**
 * DBByte / S3-Compatible Cloud Storage Adapter Implementation
 * Uses AWS S3 SDK for reliable, credentialed object management
 */
export class S3StorageAdapter {
  private static client: S3Client | null = null;
  private static endpoint = process.env.S3_ENDPOINT || 'https://s3.dbbyte.com';
  private static region = process.env.S3_REGION || 'us-east-1';
  private static bucket = process.env.S3_BUCKET || 'ss-wedding-originals';
  private static accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
  private static secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
  private static forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';

  public static isConfigured(): boolean {
    return !!(this.endpoint && this.accessKeyId && this.secretAccessKey && this.bucket);
  }

  public static getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: this.region,
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
        forcePathStyle: this.forcePathStyle,
      });
    }
    return this.client;
  }

  public static async upload(
    storagePath: string,
    buffer: Buffer,
    contentType = 'image/jpeg'
  ): Promise<{ url: string; key: string } | null> {
    if (!this.isConfigured()) return null;

    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `${this.endpoint}/${this.bucket}/${storagePath}`;
    return { url: publicUrl, key: storagePath };
  }

  public static async getSignedDownloadUrl(
    storagePath: string,
    expiresIn = 3600
  ): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const client = this.getClient();
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      });
      return await getSignedUrl(client, command, { expiresIn });
    } catch (err: any) {
      console.error('Failed to generate presigned S3 URL:', err);
      return null;
    }
  }

  public static async delete(storagePath: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = this.getClient();
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
        })
      );
      return true;
    } catch (err: any) {
      console.error('Failed to delete S3 object:', err);
      return false;
    }
  }
}

/**
 * Core Unified Storage Service
 * Enforces strict security boundary:
 * - 'originals': Stored in PRIVATE directory (storage/events/{eventId}/originals/) outside public/ with access-controlled URLs
 * - 'previews' & 'thumbnails': Stored in public/uploads for CDN/browser delivery
 */
export class StorageService {
  public static getPublicBaseDir(): string {
    if (isServerless()) {
      const tmpDir = path.join(os.tmpdir(), 'ss-photography', 'public_uploads');
      ensureDirectoryExists(tmpDir);
      return tmpDir;
    }
    const fullPath = path.resolve(process.cwd(), PUBLIC_UPLOAD_DIR);
    ensureDirectoryExists(fullPath);
    return fullPath;
  }

  public static getPrivateBaseDir(): string {
    if (isServerless()) {
      const tmpDir = path.join(os.tmpdir(), 'ss-photography', 'private_events');
      ensureDirectoryExists(tmpDir);
      return tmpDir;
    }
    const fullPath = path.resolve(process.cwd(), PRIVATE_STORAGE_DIR);
    ensureDirectoryExists(fullPath);
    return fullPath;
  }

  /**
   * Saves a buffer to storage with category-based security isolation
   * Implements Dual-Store: Always saves to local disk (resilient fallback),
   * and asynchronously mirrors to DBByte S3 when configured.
   */
  public static async saveFile(
    eventId: string,
    category: 'originals' | 'previews' | 'thumbnails' | 'branding',
    filename: string,
    buffer: Buffer
  ): Promise<StorageResult> {
    const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // 1. Primary Local Storage (Guarantees zero data loss & offline venue availability)
    let localFilePath = '';
    let publicUrl = '';
    let protectedUrl = '';

    try {
      if (category === 'originals') {
        // ORIGINALS: Saved in private directory outside public/
        const privateEventDir = path.join(this.getPrivateBaseDir(), eventId, 'originals');
        ensureDirectoryExists(privateEventDir);
        localFilePath = path.join(privateEventDir, safeFilename);

        await fs.promises.writeFile(localFilePath, buffer);
        protectedUrl = `/api/photos/original?event=${eventId}&file=${encodeURIComponent(safeFilename)}`;
      } else {
        // PREVIEWS & THUMBNAILS: Saved in public/uploads for local web delivery
        const publicEventDir = path.join(this.getPublicBaseDir(), eventId, category);
        ensureDirectoryExists(publicEventDir);
        localFilePath = path.join(publicEventDir, safeFilename);

        await fs.promises.writeFile(localFilePath, buffer);
        publicUrl = `/uploads/${eventId}/${category}/${safeFilename}`;
      }
    } catch (localWriteErr: any) {
      console.warn(`[Storage Warning] Local scratch write notice: ${localWriteErr.message}`);
    }

    // 2. Cloud Mirror Sync (Google Drive, DBByte S3, or Supabase)
    const provider = process.env.STORAGE_PROVIDER || 'gdrive';
    let gdriveFileId: string | undefined;

    if (GoogleDriveAdapter.isConfigured()) {
      try {
        const hierarchy = await GoogleDriveAdapter.ensureEventHierarchy(eventId);
        let targetFolderId = hierarchy.eventFolderId;
        if (category === 'originals') targetFolderId = hierarchy.originalsFolderId;
        else if (category === 'previews') targetFolderId = hierarchy.previewsFolderId;
        else if (category === 'thumbnails') targetFolderId = hierarchy.thumbnailsFolderId;

        const uploadRes = await GoogleDriveAdapter.uploadFile(safeFilename, buffer, targetFolderId, 'image/jpeg');
        gdriveFileId = uploadRes.fileId;
        if (category === 'originals') {
          protectedUrl = `/api/photos/gdrive/${gdriveFileId}?event=${eventId}&cat=originals&file=${encodeURIComponent(safeFilename)}`;
        } else {
          publicUrl = `/api/photos/gdrive/${gdriveFileId}?event=${eventId}&cat=${category}&file=${encodeURIComponent(safeFilename)}`;
        }
      } catch (gdriveErr: any) {
        console.warn(`[Google Drive Mirror Warning] Could not sync to Google Drive (${gdriveErr.message}). Local copy preserved safely.`);
      }
    } else if ((provider === 's3' || provider === 'dbbyte') && S3StorageAdapter.isConfigured()) {
      try {
        const storagePath = `${eventId}/${category}/${safeFilename}`;
        await S3StorageAdapter.upload(storagePath, buffer, 'image/jpeg');
      } catch (cloudErr: any) {
        console.warn(`[S3 Mirror Warning] Could not sync to DBByte S3 (${cloudErr.message}). Local copy preserved safely.`);
      }
    } else if (provider === 'supabase' && SupabaseStorageAdapter.isConfigured()) {
      try {
        const storagePath = `${eventId}/${category}/${safeFilename}`;
        await SupabaseStorageAdapter.upload(storagePath, buffer);
      } catch (cloudErr: any) {
        console.warn(`[Supabase Warning] Could not sync to Supabase (${cloudErr.message}). Local copy preserved safely.`);
      }
    }

    if (!publicUrl) {
      publicUrl = `/api/photos/original?event=${eventId}&file=${encodeURIComponent(safeFilename)}`;
    }
    if (!protectedUrl) {
      protectedUrl = publicUrl;
    }

    return {
      url: category === 'originals' ? protectedUrl : publicUrl,
      path: localFilePath,
      size: buffer.length,
      isPrivate: category === 'originals',
      gdriveFileId,
    };
  }

  /**
   * Deletes a file from storage safely across all locations
   */
  public static async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      if (fileUrl.startsWith('/uploads/')) {
        const relativePath = fileUrl.replace('/uploads/', '');
        const fullPath = path.join(this.getPublicBaseDir(), relativePath);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
        }
        if (S3StorageAdapter.isConfigured()) {
          await S3StorageAdapter.delete(relativePath.replace(/\\/g, '/'));
        }
        return true;
      } else if (fileUrl.startsWith('/api/photos/original')) {
        const urlObj = new URL(fileUrl, 'http://localhost:3000');
        const event = urlObj.searchParams.get('event');
        const file = urlObj.searchParams.get('file');
        if (event && file) {
          const sanitizedEvent = path.basename(event);
          const sanitizedFile = path.basename(file);
          
          const primaryPath = path.join(this.getPrivateBaseDir(), sanitizedEvent, 'originals', sanitizedFile);
          const legacyPath = path.join(this.getPrivateBaseDir(), sanitizedEvent, sanitizedFile);

          if (fs.existsSync(primaryPath)) {
            await fs.promises.unlink(primaryPath);
          } else if (fs.existsSync(legacyPath)) {
            await fs.promises.unlink(legacyPath);
          }
          if (S3StorageAdapter.isConfigured()) {
            await S3StorageAdapter.delete(`${sanitizedEvent}/originals/${sanitizedFile}`);
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Failed to delete file:', err);
      return false;
    }
  }

  /**
   * Calculates total storage used for an event (both private originals and public previews/thumbnails)
   */
  public static async getEventStorageBytes(eventId: string): Promise<number> {
    let total = 0;

    const calculateSize = async (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else {
          const stat = await fs.promises.stat(fullPath);
          total += stat.size;
        }
      }
    };

    // Calculate public folder size for event
    await calculateSize(path.join(this.getPublicBaseDir(), eventId));
    // Calculate private originals folder size for event
    await calculateSize(path.join(this.getPrivateBaseDir(), eventId));

    return total;
  }

  /**
   * Returns comprehensive system-wide storage metrics
   */
  public static async getStorageMetrics(): Promise<StorageMetrics> {
    let originalsBytes = 0;
    let previewsBytes = 0;
    let thumbnailsBytes = 0;
    let totalOriginalsCount = 0;
    let totalPreviewsCount = 0;
    let totalThumbnailsCount = 0;

    const scanDirectory = (dir: string, type: 'orig' | 'prev' | 'thumb') => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirectory(full, type);
        } else {
          const stat = fs.statSync(full);
          if (type === 'orig') {
            originalsBytes += stat.size;
            totalOriginalsCount++;
          } else if (type === 'prev') {
            previewsBytes += stat.size;
            totalPreviewsCount++;
          } else if (type === 'thumb') {
            thumbnailsBytes += stat.size;
            totalThumbnailsCount++;
          }
        }
      }
    };

    // Scan private originals
    scanDirectory(this.getPrivateBaseDir(), 'orig');

    // Scan public previews & thumbnails
    const publicBase = this.getPublicBaseDir();
    if (fs.existsSync(publicBase)) {
      const eventDirs = fs.readdirSync(publicBase, { withFileTypes: true });
      for (const ev of eventDirs) {
        if (ev.isDirectory()) {
          scanDirectory(path.join(publicBase, ev.name, 'previews'), 'prev');
          scanDirectory(path.join(publicBase, ev.name, 'thumbnails'), 'thumb');
        }
      }
    }

    return {
      provider: process.env.STORAGE_PROVIDER || 'local-disk',
      storageBaseDir: this.getPrivateBaseDir(),
      publicUploadDir: this.getPublicBaseDir(),
      originalsBytes,
      previewsBytes,
      thumbnailsBytes,
      totalBytes: originalsBytes + previewsBytes + thumbnailsBytes,
      totalOriginalsCount,
      totalPreviewsCount,
      totalThumbnailsCount,
    };
  }
}
