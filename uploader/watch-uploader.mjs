/**
 * SS PHOTOGRAPHY — NIKON D750 TETHERED FOLDER WATCHER & AUTO-UPLOADER (ESM)
 *
 * Architecture:
 * - Instant Live Publish (~4s per DSLR photo): Sends crisp 2048px HD JPEG (< 1 MB) first
 *   so photos + AI Face Scan appear on the live website within seconds.
 * - Background Master Sync: Uploads full untouched 6048x4024 Nikon Originals (9-25 MB+)
 *   directly to Google Drive in resilient 2 MB resumable chunks (never hits Vercel 4.5 MB cap
 *   or venue Wi-Fi timeouts), then seamlessly upgrades the photo's originalUrl via PATCH /api/photos.
 * - Auto-Delete Sync + Startup & Periodic Reconciliation.
 * - Single-Instance PID Lock + IPv4-first DNS + Persistent Disk Queues.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns';
import chokidar from 'chokidar';
import sharp from 'sharp';

dns.setDefaultResultOrder('ipv4first');

const QUEUE_FILE = path.resolve(process.cwd(), 'uploader/uploader-queue.json');
const MASTER_QUEUE_FILE = path.resolve(process.cwd(), 'uploader/master-queue.json');
const HASHES_FILE = path.resolve(process.cwd(), 'uploader/uploaded-hashes.json');
const CONFIG_FILE = path.resolve(process.cwd(), 'uploader/active-event.json');
const PID_FILE = path.resolve(process.cwd(), 'uploader/uploader.pid');
const LOG_FILE = path.resolve(process.cwd(), 'uploader/uploader-service.log');
const DEFAULT_LIVE_URL = 'https://ss-photography-studio.vercel.app';
const DIRECT_UPLOAD_THRESHOLD_BYTES = 3.2 * 1024 * 1024;
const DRIVE_CHUNK_SIZE = 2 * 1024 * 1024; // Exact multiple of 256 KiB required by Google Drive

function appendLogFile(line) {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const st = fs.statSync(LOG_FILE);
      if (st.size > 2 * 1024 * 1024) {
        fs.writeFileSync(LOG_FILE, '', 'utf8');
      }
    }
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {}
}

function acquireSingleInstanceLock() {
  try {
    const dir = path.dirname(PID_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(PID_FILE)) {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      if (oldPid && oldPid !== process.pid) {
        try {
          process.kill(oldPid, 0);
          console.log(`[INSTANCE] Replacing older uploader process (PID ${oldPid})...`);
          process.kill(oldPid, 'SIGTERM');
          const waitUntil = Date.now() + 800;
          while (Date.now() < waitUntil) {
            try {
              process.kill(oldPid, 0);
            } catch {
              break;
            }
          }
        } catch {}
      }
    }

    fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');

    const cleanupPid = () => {
      try {
        if (fs.existsSync(PID_FILE) && fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) {
          fs.unlinkSync(PID_FILE);
        }
      } catch {}
    };
    process.on('exit', cleanupPid);
    process.on('SIGINT', () => {
      cleanupPid();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanupPid();
      process.exit(0);
    });
  } catch (err) {
    console.warn('[LOCK NOTICE]', err.message);
  }
}

async function robustFetch(url, options = {}, retries = 3, timeoutMs = 45000) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastErr;
}

async function uploadBufferInChunksToDrive(uploadUrl, fileBuffer) {
  const totalSize = fileBuffer.length;
  let offset = 0;

  while (offset < totalSize) {
    const end = Math.min(offset + DRIVE_CHUNK_SIZE, totalSize);
    const chunk = fileBuffer.subarray(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${totalSize}`;

    const res = await robustFetch(
      uploadUrl,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(chunk.length),
          'Content-Range': contentRange,
        },
        body: chunk,
      },
      3,
      60000
    );

    if (res.status === 308) {
      // Chunk accepted; Google Drive indicates next byte via Range header if needed
      offset = end;
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      return data; // Completed on final chunk
    }

    const errText = await res.text().catch(() => '');
    throw new Error(`Drive chunk failed (${contentRange}): HTTP ${res.status} ${errText}`);
  }

  throw new Error('Drive resumable upload finished loop without Drive file metadata');
}

function collectFilesRecursive(dir, maxDepth = 2, currentDepth = 0, out = []) {
  if (!fs.existsSync(dir) || currentDepth > maxDepth) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, maxDepth, currentDepth + 1, out);
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let watchFolder = process.env.CAMERA_MONITORED_DIR || 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox';
  let eventId = process.env.CAMERA_DEFAULT_EVENT_ID || '';
  let serverUrl = process.env.CAMERA_SERVER_URL || DEFAULT_LIVE_URL;
  let apiKey = process.env.CAMERA_INGEST_API_KEY || 'ss_cam_ingest_key_wedding_2026';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--folder' && args[i + 1]) watchFolder = args[++i];
    if (args[i] === '--event' && args[i + 1]) eventId = args[++i];
    if (args[i] === '--server' && args[i + 1]) serverUrl = args[++i];
    if (args[i] === '--local') serverUrl = 'http://localhost:3000';
    if (args[i] === '--key' && args[i + 1]) apiKey = args[++i];
  }

  serverUrl = serverUrl.replace(/\/$/, '');

  if (!eventId && fs.existsSync(CONFIG_FILE)) {
    try {
      const activeCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      eventId = activeCfg.eventId || activeCfg.activeEventId || '';
    } catch {}
  }

  return { watchFolder, eventId, serverUrl, apiKey };
}

class NikonCameraUploader {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.masterQueue = [];
    this.uploadedHashes = new Map();
    this.isProcessing = false;
    this.isProcessingMasters = false;
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
    this.loadMasterQueueFromDisk();
    this.loadHashesFromDisk();
  }

  log(msg) {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${msg}`;
    console.log(formatted);
    appendLogFile(formatted);
    this.recentLogs.push(formatted);
    if (this.recentLogs.length > 20) this.recentLogs.shift();
  }

  loadQueueFromDisk() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const saved = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        if (Array.isArray(saved)) {
          this.queue = saved.filter((item) => item.status === 'PENDING' || item.status === 'RETRY');
        }
      }
    } catch {
      this.queue = [];
    }
  }

  saveQueueToDisk() {
    try {
      const dir = path.dirname(QUEUE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2), 'utf8');
    } catch {}
  }

  loadMasterQueueFromDisk() {
    try {
      if (fs.existsSync(MASTER_QUEUE_FILE)) {
        const saved = JSON.parse(fs.readFileSync(MASTER_QUEUE_FILE, 'utf8'));
        if (Array.isArray(saved)) this.masterQueue = saved;
      }
    } catch {
      this.masterQueue = [];
    }
  }

  saveMasterQueueToDisk() {
    try {
      fs.writeFileSync(MASTER_QUEUE_FILE, JSON.stringify(this.masterQueue, null, 2), 'utf8');
    } catch {}
  }

  loadHashesFromDisk() {
    try {
      if (fs.existsSync(HASHES_FILE)) {
        const data = JSON.parse(fs.readFileSync(HASHES_FILE, 'utf8'));
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          for (const [hash, fname] of Object.entries(data)) {
            this.uploadedHashes.set(hash, fname);
          }
        }
      }
    } catch {}
  }

  saveHashesToDisk() {
    try {
      const obj = Object.fromEntries(Array.from(this.uploadedHashes.entries()).slice(-5000));
      fs.writeFileSync(HASHES_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch {}
  }

  removeHashByFilename(filename) {
    let changed = false;
    for (const [hash, fname] of this.uploadedHashes.entries()) {
      if (fname === filename) {
        this.uploadedHashes.delete(hash);
        changed = true;
      }
    }
    if (changed) this.saveHashesToDisk();
  }

  async resolveActiveEvent() {
    try {
      const res = await robustFetch(`${this.config.serverUrl}/api/uploader/active-event`, {}, 2, 10000);
      if (res.ok) {
        const data = await res.json();
        const resolvedId = data.eventId || data.activeEventId || '';
        if (resolvedId) {
          this.config.eventId = resolvedId;
          this.activeEventTitle = data.eventTitle || `Event (${resolvedId})`;
          return;
        }
      }
    } catch {}

    this.activeEventTitle = this.config.eventId
      ? `Event (${this.config.eventId})`
      : '(Auto-assigns to latest active)';
  }

  async sendHeartbeat() {
    try {
      await robustFetch(
        `${this.config.serverUrl}/api/uploader/status`,
        {
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
        },
        1,
        8000
      );
    } catch {}
  }

  async start() {
    await this.resolveActiveEvent();

    const banner = [
      '',
      '======================================================',
      '   SS PHOTOGRAPHY — NIKON D750 LIVE INGEST DAEMON',
      '======================================================',
      `[CONFIG] Monitored Folder : ${this.config.watchFolder}`,
      `[CONFIG] Active Wedding   : ${this.activeEventTitle}`,
      `[CONFIG] Cloud Website    : ${this.config.serverUrl}`,
      `[CONFIG] Persistent Queue : ${QUEUE_FILE}`,
      '------------------------------------------------------',
    ].join('\n');
    console.log(banner);
    appendLogFile(banner);

    if (!fs.existsSync(this.config.watchFolder)) {
      try {
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
      } catch {
        this.config.watchFolder = path.join(process.cwd(), 'tether_inbox');
        fs.mkdirSync(this.config.watchFolder, { recursive: true });
      }
    }

    setInterval(() => this.sendHeartbeat(), 5000);
    setInterval(() => this.reconcileLocalFolderWithServer(), 60000);

    const watcher = chokidar.watch(this.config.watchFolder, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      depth: 2,
      usePolling: true,
      interval: 1000,
      binaryInterval: 1500,
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 1500,
        pollInterval: 400,
      },
    });

    watcher
      .on('add', (filePath) => this.handleNewFile(filePath))
      .on('unlink', (filePath) => this.handleDeletedFile(filePath))
      .on('error', (err) => {
        if (err.code === 'EBUSY') return;
        console.warn('[WATCHER NOTICE]', err.message || err);
      })
      .on('ready', async () => {
        this.log('Camera Watcher active! Ready for incoming Nikon D750 captures.');
        this.log(`Save shots to: ${this.config.watchFolder}`);
        await this.reconcileLocalFolderWithServer();
        if (this.queue.length > 0) this.processQueue();
        if (this.masterQueue.length > 0) this.processMasterQueue();
      });
  }

  async reconcileLocalFolderWithServer() {
    try {
      if (!fs.existsSync(this.config.watchFolder)) return;
      const localFiles = new Set(collectFilesRecursive(this.config.watchFolder, 2));

      const res = await robustFetch(`${this.config.serverUrl}/api/photos?limit=500`, {}, 2, 15000);
      if (!res.ok) return;
      const data = await res.json();
      const serverPhotos = data.photos || [];

      let prunedCount = 0;
      for (const photo of serverPhotos) {
        if (photo.source !== 'CAMERA_TETHER') continue;

        if (!localFiles.has(photo.filename)) {
          this.log(`[SYNC AUDIT] Removing stale web photo (deleted locally): ${photo.filename}`);
          const delRes = await robustFetch(
            `${this.config.serverUrl}/api/photos`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'x-camera-ingest-key': this.config.apiKey,
              },
              body: JSON.stringify({ id: photo.id, filename: photo.filename }),
            },
            2,
            15000
          );
          if (delRes.ok) {
            this.removeHashByFilename(photo.filename);
            prunedCount++;
          }
        }
      }

      if (prunedCount > 0) {
        this.log(`✔ [SYNC AUDIT COMPLETE] Removed ${prunedCount} deleted photo(s) from live website.`);
      }
    } catch {}
  }

  async handleDeletedFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.nef', '.webp'].includes(ext)) return;

    const filename = path.basename(filePath);
    this.removeHashByFilename(filename);

    const origQueueLen = this.queue.length;
    this.queue = this.queue.filter((q) => q.filePath !== filePath && q.filename !== filename);
    if (this.queue.length !== origQueueLen) this.saveQueueToDisk();

    const origMasterLen = this.masterQueue.length;
    this.masterQueue = this.masterQueue.filter((m) => m.filePath !== filePath && m.filename !== filename);
    if (this.masterQueue.length !== origMasterLen) this.saveMasterQueueToDisk();

    this.log(`[LOCAL DELETION DETECTED] ${filename} removed from tether inbox. Removing from website...`);

    try {
      const response = await robustFetch(`${this.config.serverUrl}/api/photos`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-camera-ingest-key': this.config.apiKey,
        },
        body: JSON.stringify({
          filename,
          eventId: this.config.eventId,
        }),
      });

      if (response.ok) {
        this.log(`🗑 [AUTO-REMOVED] ${filename} deleted from live website and Google Drive.`);
      } else if (response.status === 404) {
        this.log(`[DELETE SYNC] ${filename} already removed from website.`);
      } else {
        const errData = await response.json().catch(() => ({}));
        this.log(`[DELETE WARNING] Could not remove ${filename}: ${errData.error || response.statusText}`);
      }
    } catch (delErr) {
      this.log(`[DELETE ERROR] Network issue deleting ${filename}: ${delErr.message}`);
    }
  }

  async handleNewFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.nef', '.webp'].includes(ext)) return;

    const filename = path.basename(filePath);
    if (this.queue.some((q) => q.filePath === filePath)) return;

    try {
      const stat = fs.statSync(filePath);
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
      const quickBuf = await fs.promises.readFile(filePath);
      const quickHash = crypto.createHash('sha256').update(quickBuf).digest('hex');

      if (this.uploadedHashes.has(quickHash)) {
        this.uploadedHashes.set(quickHash, filename);
        return;
      }

      this.stats.detected++;
      this.log(`[NEW CAPTURE] ${filename} (${sizeMB} MB)`);

      this.queue.push({
        id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filePath,
        filename,
        fileSize: stat.size,
        sha256: quickHash,
        status: 'PENDING',
        attempts: 0,
        addedAt: new Date().toISOString(),
      });
      this.saveQueueToDisk();
      this.processQueue();
    } catch {}
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
          this.queue.shift();
          this.saveQueueToDisk();
        } else {
          this.log(`[OFFLINE/BACKOFF] Pausing queue 5s before retry...`);
          await new Promise((res) => setTimeout(res, 5000));
          break;
        }
      } catch (err) {
        this.log(`[PROCESS ERROR] ${item.filename}: ${err.message}`);
        this.queue.shift();
        this.saveQueueToDisk();
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 5000);
    }
  }

  async uploadQueueItem(item) {
    if (!fs.existsSync(item.filePath)) {
      this.log(`[SKIP] File deleted before ingest: ${item.filename}`);
      return true;
    }

    let fileBuffer;
    for (let attempts = 0; attempts < 5; attempts++) {
      try {
        fileBuffer = await fs.promises.readFile(item.filePath);
        break;
      } catch (readErr) {
        if (readErr.code === 'EBUSY') {
          await new Promise((r) => setTimeout(r, 600));
        } else {
          throw readErr;
        }
      }
    }

    if (!fileBuffer) return false;

    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    item.sha256 = hash;

    if (this.uploadedHashes.has(hash)) {
      this.stats.duplicates++;
      this.log(`[SKIP DUPLICATE] ${item.filename} already synced to website.`);
      return true;
    }

    item.attempts++;
    item.status = 'UPLOADING';

    try {
      let uploadBuffer = fileBuffer;
      let originalWidth = 0;
      let originalHeight = 0;
      const isLargeMaster = fileBuffer.length > DIRECT_UPLOAD_THRESHOLD_BYTES;

      if (isLargeMaster) {
        const rotated = sharp(fileBuffer).rotate();
        const meta = await rotated.metadata();
        originalWidth = meta.width || 0;
        originalHeight = meta.height || 0;

        // Crisp 2048px web master (< 1 MB) for instant live website publish + YuNet AI Scan
        uploadBuffer = await rotated
          .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 86, mozjpeg: true })
          .toBuffer();
      }

      const formData = new FormData();
      const blob = new Blob([new Uint8Array(uploadBuffer)], { type: 'image/jpeg' });
      formData.append('file', blob, item.filename);
      if (this.config.eventId) formData.append('eventId', this.config.eventId);
      formData.append('source', 'CAMERA_TETHER');
      formData.append('sourceDevice', 'Nikon D750');
      formData.append('originalFilename', item.filename);
      formData.append('originalSha256', hash);
      formData.append('originalFileSize', String(fileBuffer.length));
      if (originalWidth) formData.append('originalWidth', String(originalWidth));
      if (originalHeight) formData.append('originalHeight', String(originalHeight));

      const response = await robustFetch(`${this.config.serverUrl}/api/upload/ingest`, {
        method: 'POST',
        headers: { 'x-camera-ingest-key': this.config.apiKey },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      this.uploadedHashes.set(hash, item.filename);
      this.saveHashesToDisk();

      if (data.duplicate) {
        this.stats.duplicates++;
        this.log(`[DUPLICATE SKIPPED] ${item.filename} already on website.`);
      } else {
        this.stats.uploaded++;
        this.stats.lastUploadedFile = item.filename;
        this.stats.lastUploadedAt = new Date().toISOString();
        this.log(
          `✔ [LIVE ON WEB] ${item.filename} (${(fileBuffer.length / 1048576).toFixed(2)} MB) synced! (Faces: ${data.photo?.faceCount ?? 0})`
        );

        // Queue untouched full-res original master upload to Google Drive in resilient 2 MB chunks
        if (isLargeMaster && data.photo?.id) {
          this.masterQueue.push({
            photoId: data.photo.id,
            eventId: data.eventId || this.config.eventId,
            filePath: item.filePath,
            filename: item.filename,
            fileSize: fileBuffer.length,
          });
          this.saveMasterQueueToDisk();
          this.processMasterQueue();
        }
      }

      return true;
    } catch (err) {
      item.status = 'RETRY';
      item.lastError = err.message;
      this.stats.failed++;
      const causeMsg = err.cause?.code ? ` (${err.cause.code})` : '';
      this.log(`✖ [UPLOAD FAILED] ${item.filename} (Attempt ${item.attempts}): ${err.message}${causeMsg}`);
      return false;
    }
  }

  async processMasterQueue() {
    if (this.isProcessingMasters || this.masterQueue.length === 0) return;
    this.isProcessingMasters = true;

    while (this.masterQueue.length > 0) {
      const m = this.masterQueue[0];
      if (!m) break;

      if (!fs.existsSync(m.filePath)) {
        this.masterQueue.shift();
        this.saveMasterQueueToDisk();
        continue;
      }

      try {
        const rawBuf = await fs.promises.readFile(m.filePath);
        const sessionRes = await robustFetch(`${this.config.serverUrl}/api/upload/gdrive-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-camera-ingest-key': this.config.apiKey,
          },
          body: JSON.stringify({
            eventId: m.eventId,
            filename: m.filename,
            mimeType: 'image/jpeg',
            fileSize: rawBuf.length,
            skipDuplicateCheck: true,
          }),
        });

        if (!sessionRes.ok) {
          throw new Error(`Session init HTTP ${sessionRes.status}`);
        }

        const session = await sessionRes.json();
        if (session.gdriveConfigured && session.uploadUrl) {
          this.log(
            `[MASTER SYNC] Uploading full ${(rawBuf.length / 1048576).toFixed(2)} MB master ${m.filename} (2 MB chunks)...`
          );
          const driveFile = await uploadBufferInChunksToDrive(session.uploadUrl, rawBuf);

          const patchRes = await robustFetch(`${this.config.serverUrl}/api/photos`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-camera-ingest-key': this.config.apiKey,
            },
            body: JSON.stringify({
              id: m.photoId,
              originalDriveFileId: driveFile.id,
              originalSafeFilename: session.safeFilename,
            }),
          });

          if (patchRes.ok) {
            this.log(
              `★ [MASTER ARCHIVED] Full ${(rawBuf.length / 1048576).toFixed(2)} MB Nikon original ${m.filename} live on Google Drive!`
            );
          }
        }

        this.masterQueue.shift();
        this.saveMasterQueueToDisk();
      } catch (err) {
        this.log(`[MASTER RETRY LATER] ${m.filename}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 8000));
        break;
      }
    }

    this.isProcessingMasters = false;
    if (this.masterQueue.length > 0) {
      setTimeout(() => this.processMasterQueue(), 8000);
    }
  }
}

acquireSingleInstanceLock();

const config = parseArgs();
const uploader = new NikonCameraUploader(config);
uploader.start();
