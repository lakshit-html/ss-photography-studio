/**
 * SS PHOTOGRAPHY — NIKON D750 TETHERED FOLDER WATCHER & AUTO-UPLOADER
 *
 * Usage:
 *   npm run uploader
 *   node uploader/watch-uploader.mjs --folder "C:/SSPhotography/Tethered_Ingest" --event "EVENT_ID"
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar from 'chokidar';
import { fileURLToPath } from 'url';

interface UploaderConfig {
  watchFolder: string;
  eventId: string;
  serverUrl: string;
  apiKey: string;
}

// Parse command line arguments
function parseArgs(): UploaderConfig {
  const args = process.argv.slice(2);
  let watchFolder = process.env.CAMERA_MONITORED_DIR || 'C:/SSPhotography/Tethered_Ingest';
  let eventId = process.env.CAMERA_DEFAULT_EVENT_ID || '';
  let serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let apiKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--folder' && args[i + 1]) watchFolder = args[++i];
    if (args[i] === '--event' && args[i + 1]) eventId = args[++i];
    if (args[i] === '--server' && args[i + 1]) serverUrl = args[++i];
    if (args[i] === '--key' && args[i + 1]) apiKey = args[++i];
  }

  return { watchFolder, eventId, serverUrl, apiKey };
}

class NikonCameraUploader {
  private config: UploaderConfig;
  private uploadedHashes = new Set<string>();
  private queue: string[] = [];
  private isProcessing = false;
  private stats = {
    detected: 0,
    uploaded: 0,
    duplicates: 0,
    failed: 0,
  };

  constructor(config: UploaderConfig) {
    this.config = config;
  }

  public async start() {
    console.log('\n======================================================');
    console.log('   SS PHOTOGRAPHY — NIKON D750 AUTO-INGESTION DAEMON');
    console.log('======================================================');
    console.log(`[CONFIG] Watched Directory : ${this.config.watchFolder}`);
    console.log(`[CONFIG] Destination Event : ${this.config.eventId || '(Auto-assigns to latest active event)'}`);
    console.log(`[CONFIG] Server Endpoint   : ${this.config.serverUrl}/api/upload/ingest`);
    console.log('------------------------------------------------------\n');

    if (!fs.existsSync(this.config.watchFolder)) {
      try {
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
        console.log(`[INIT] Created monitored folder: ${this.config.watchFolder}`);
      } catch (err: any) {
        console.warn(`[WARN] Could not create folder at ${this.config.watchFolder}: ${err.message}`);
        // Fallback to local project tether_inbox
        this.config.watchFolder = path.join(process.cwd(), 'tether_inbox');
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
        console.log(`[INIT] Fallback monitored folder: ${this.config.watchFolder}`);
      }
    }

    // Initialize watcher with awaitWriteFinish so Nikon D750 RAW/JPG transfers don't get read partially
    const watcher = chokidar.watch(this.config.watchFolder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 1500, // wait 1.5s after camera finishes writing file
        pollInterval: 300,
      },
    });

    watcher
      .on('add', (filePath) => this.handleNewFile(filePath))
      .on('error', (err) => console.error('[WATCHER ERROR]', err))
      .on('ready', () => {
        console.log('[WATCHER ACTIVE] Ready! Waiting for incoming Nikon D750 captures...\n');
        console.log(`Place or tether your photos into: ${this.config.watchFolder}`);
      });
  }

  private async handleNewFile(filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.nef', '.webp'].includes(ext)) {
      return;
    }

    this.stats.detected++;
    const filename = path.basename(filePath);
    const sizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
    console.log(`[NEW CAPTURE] ${filename} (${sizeMB} MB)`);

    this.queue.push(filePath);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const filePath = this.queue.shift();
      if (!filePath) continue;

      try {
        await this.uploadFileWithRetry(filePath, 3);
      } catch (err: any) {
        this.stats.failed++;
        console.error(`[UPLOAD FAILED] ${path.basename(filePath)}: ${err.message}`);
      }
    }

    this.isProcessing = false;
  }

  private async uploadFileWithRetry(filePath: string, maxRetries = 3): Promise<void> {
    const filename = path.basename(filePath);
    const fileBuffer = await fs.promises.readFile(filePath);

    // Compute SHA-256 to prevent duplicate uploads
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (this.uploadedHashes.has(hash)) {
      this.stats.duplicates++;
      console.log(`[SKIP DUPLICATE] ${filename} already ingested.`);
      return;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[UPLOADING] ${filename} (Attempt ${attempt}/${maxRetries})...`);

        const formData = new FormData();
        const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/jpeg' });
        formData.append('file', blob, filename);
        if (this.config.eventId) {
          formData.append('eventId', this.config.eventId);
        }
        formData.append('source', 'CAMERA_TETHER');
        formData.append('sourceDevice', 'Nikon D750');

        const response = await fetch(`${this.config.serverUrl}/api/upload/ingest`, {
          method: 'POST',
          headers: {
            'x-camera-ingest-key': this.config.apiKey,
          },
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        this.uploadedHashes.add(hash);
        this.stats.uploaded++;

        console.log(`[SUCCESS] ${filename} ingested! Event: ${data.eventTitle || data.eventId} (Faces: ${data.faceCount})`);
        this.printStats();
        return;
      } catch (err: any) {
        if (attempt === maxRetries) throw err;
        const delay = attempt * 1500;
        console.warn(`[RETRY] Retrying in ${delay}ms... (${err.message})`);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  private printStats() {
    console.log(
      `[STATS] Detected: ${this.stats.detected} | Uploaded: ${this.stats.uploaded} | Duplicates: ${this.stats.duplicates} | Failed: ${this.stats.failed}\n`
    );
  }
}

// ESM-safe entry point execution
const config = parseArgs();
const uploader = new NikonCameraUploader(config);
uploader.start();

export { NikonCameraUploader };
