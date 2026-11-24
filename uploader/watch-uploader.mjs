/**
 * SS PHOTOGRAPHY — NIKON D750 TETHERED FOLDER WATCHER & AUTO-UPLOADER (ESM)
 *
 * Production Features:
 * - Persistent Disk Queue (survives app restarts & laptop reboots)
 * - Offline Resiliency (buffers captures during wifi disconnects, resumes on reconnect)
 * - Dynamic Active Wedding Selector (via admin UI or CLI)
 * - SHA-256 Duplicate Prevention
 * - 1.5s Camera Write-Stability Buffer
 * - Real-Time Heartbeat Reporting to Studio Admin Monitor
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar from 'chokidar';

const QUEUE_FILE = path.resolve(process.cwd(), 'uploader/uploader-queue.json');
const CONFIG_FILE = path.resolve(process.cwd(), 'uploader/active-event.json');

function parseArgs() {
  const args = process.argv.slice(2);
  let watchFolder = process.env.CAMERA_MONITORED_DIR || 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox';
  let eventId = process.env.CAMERA_DEFAULT_EVENT_ID || '';
  let serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let apiKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--folder' && args[i + 1]) watchFolder = args[++i];
    if (args[i] === '--event' && args[i + 1]) eventId = args[++i];
    if (args[i] === '--server' && args[i + 1]) serverUrl = args[++i];
    if (args[i] === '--key' && args[i + 1]) apiKey = args[++i];
  }

  // If no CLI event provided, check active-event.json
  if (!eventId && fs.existsSync(CONFIG_FILE)) {
    try {
      const activeCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (activeCfg.activeEventId) eventId = activeCfg.activeEventId;
      else if (activeCfg.eventId) eventId = activeCfg.eventId;
    } catch {}
  }

  return { watchFolder, eventId, serverUrl, apiKey };
}

class NikonCameraUploader {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.uploadedHashes = new Set();
    this.isProcessing = false;
    this.recentLogs = [];
    this.activeEventTitle = '';
    this.stats = {
      detected: 0,
      uploaded: 0,
      duplicates: 0,
      failed: 0,
      lastUploadedFile: null,
      lastUploadedAt: null,
    };

    this.loadQueueFromDisk();
  }

  log(msg) {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    console.log(formatted);
    this.recentLogs.push(formatted);
    if (this.recentLogs.length > 20) this.recentLogs.shift();
  }

  loadQueueFromDisk() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
        const savedQueue = JSON.parse(raw);
        if (Array.isArray(savedQueue)) {
          // Keep only PENDING or RETRY items
          this.queue = savedQueue.filter((item) => item.status === 'PENDING' || item.status === 'RETRY');
          // Populate uploaded hashes
          for (const item of savedQueue) {
            if (item.status === 'COMPLETED' && item.sha256) {
              this.uploadedHashes.add(item.sha256);
            }
          }
          if (this.queue.length > 0) {
            this.log(`[RECOVERY] Recovered ${this.queue.length} pending photo(s) from local queue.`);
          }
        }
      }
    } catch (err) {
      console.warn('[WARN] Could not parse queue file, starting fresh:', err.message);
      this.queue = [];
    }
  }

  saveQueueToDisk() {
    try {
      const dir = path.dirname(QUEUE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch (err) {
      console.error('[ERROR] Failed to save queue to disk:', err.message);
    }
  }

  async resolveActiveEvent() {
    try {
      const res = await fetch(`${this.config.serverUrl}/api/uploader/active-event`);
      if (res.ok) {
        const data = await res.json();
        if (data.eventId) {
          if (!this.config.eventId) this.config.eventId = data.eventId;
          this.activeEventTitle = data.eventTitle || 'Active Event';
          return;
        }
      }
    } catch {}

    this.activeEventTitle = this.config.eventId ? `Event (${this.config.eventId})` : '(Auto-assigns to latest active)';
  }

  async sendHeartbeat() {
    try {
      await fetch(`${this.config.serverUrl}/api/uploader/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-camera-ingest-key': this.config.apiKey,
        },
        body: JSON.stringify({
          activeEventId: this.config.eventId,
          activeEventTitle: this.activeEventTitle,
          tetherDir: this.config.watchFolder,
          detectedCount: this.stats.detected,
          uploadedCount: this.stats.uploaded,
          pendingCount: this.queue.length,
          failedCount: this.stats.failed,
          lastUploadedFile: this.stats.lastUploadedFile,
          lastUploadedAt: this.stats.lastUploadedAt,
          recentLogs: this.recentLogs,
        }),
      });
    } catch {
      // Server temporarily unreachable (offline mode)
    }
  }

  async start() {
    await this.resolveActiveEvent();

    console.log('\n======================================================');
    console.log('   SS PHOTOGRAPHY — NIKON D750 LIVE INGEST DAEMON');
    console.log('======================================================');
    console.log(`[CONFIG] Monitored Folder : ${this.config.watchFolder}`);
    console.log(`[CONFIG] Active Wedding   : ${this.activeEventTitle}`);
    console.log(`[CONFIG] Server Endpoint  : ${this.config.serverUrl}/api/upload/ingest`);
    console.log(`[CONFIG] Persistent Queue : ${QUEUE_FILE}`);
    console.log('------------------------------------------------------\n');

    if (!fs.existsSync(this.config.watchFolder)) {
      try {
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
        this.log(`Created monitored folder: ${this.config.watchFolder}`);
      } catch (err) {
        this.config.watchFolder = path.join(process.cwd(), 'tether_inbox');
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
        this.log(`Using fallback monitored folder: ${this.config.watchFolder}`);
      }
    }

    // Heartbeat timer (every 3 seconds)
    setInterval(() => this.sendHeartbeat(), 3000);

    // Watcher with write-stability
    const watcher = chokidar.watch(this.config.watchFolder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 1500, // 1.5 seconds stability buffer for full camera flush
        pollInterval: 300,
      },
    });

    watcher
      .on('add', (filePath) => this.handleNewFile(filePath))
      .on('error', (err) => console.error('[WATCHER ERROR]', err))
      .on('ready', () => {
        this.log('Camera Watcher active! Ready for incoming Nikon D750 captures.');
        this.log(`Save shots to: ${this.config.watchFolder}\n`);
        // Process any recovered queue items
        if (this.queue.length > 0) this.processQueue();
      });
  }

  async handleNewFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.nef', '.webp'].includes(ext)) return;

    const filename = path.basename(filePath);

    // Avoid adding duplicates to queue
    const alreadyQueued = this.queue.some((q) => q.filePath === filePath);
    if (alreadyQueued) return;

    this.stats.detected++;
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
    this.log(`[NEW CAPTURE] ${filename} (${sizeMB} MB)`);

    const queueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      filePath,
      filename,
      fileSize: stat.size,
      status: 'PENDING',
      attempts: 0,
      addedAt: new Date().toISOString(),
    };

    this.queue.push(queueItem);
    this.saveQueueToDisk();
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      if (!item) break;

      try {
        const success = await this.uploadQueueItem(item);
        if (success) {
          // Remove from queue upon success
          this.queue.shift();
          this.saveQueueToDisk();
        } else {
          // Back off if server is unreachable
          this.log(`[OFFLINE/BACKOFF] Server unavailable. Pausing queue for 5 seconds...`);
          await new Promise((res) => setTimeout(res, 5000));
        }
      } catch (err) {
        this.log(`[PROCESS ERROR] ${item.filename}: ${err.message}`);
        this.queue.shift();
        this.saveQueueToDisk();
      }
    }

    this.isProcessing = false;
  }

  async uploadQueueItem(item) {
    if (!fs.existsSync(item.filePath)) {
      this.log(`[SKIP] File deleted before ingest: ${item.filename}`);
      return true;
    }

    const fileBuffer = await fs.promises.readFile(item.filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    item.sha256 = hash;

    if (this.uploadedHashes.has(hash)) {
      this.stats.duplicates++;
      this.log(`[SKIP DUPLICATE] ${item.filename} already ingested.`);
      item.status = 'COMPLETED';
      return true;
    }

    item.attempts++;
    item.status = 'UPLOADING';

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/jpeg' });
      formData.append('file', blob, item.filename);

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
      this.stats.lastUploadedFile = item.filename;
      this.stats.lastUploadedAt = new Date().toISOString();
      item.status = 'COMPLETED';

      this.log(
        `✔ [INGEST SUCCESS] ${item.filename} -> ${data.eventTitle || data.eventId} (Faces: ${data.photo?.faceCount || 0})`
      );
      return true;
    } catch (err) {
      item.status = 'RETRY';
      item.lastError = err.message;
      this.stats.failed++;
      this.log(`✖ [UPLOAD FAILED] ${item.filename} (Attempt ${item.attempts}): ${err.message}`);
      return false; // Will trigger backoff and retry without losing the file
    }
  }
}

// Start daemon
const config = parseArgs();
const uploader = new NikonCameraUploader(config);
uploader.start();
