'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Upload,
  Trash2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Image as ImageIcon,
  Check,
  Eye,
} from 'lucide-react';

export default function AdminPhotosPage() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentFile: string;
    percent: number;
  } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        if (data.length > 0 && !selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const url = selectedEventId
        ? `/api/photos?eventId=${selectedEventId}&limit=100`
        : '/api/photos?limit=100';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchPhotos();
    }
  }, [selectedEventId]);

  const computeFileSha256 = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const createWebOptimizedImage = async (
    file: File,
    maxEdge = 2048,
    quality = 0.88
  ): Promise<{ blob: Blob; width: number; height: number }> => {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const origW = bitmap.width;
    const origH = bitmap.height;
    const scale = Math.min(1, maxEdge / Math.max(origW, origH));
    const targetW = Math.max(1, Math.round(origW * scale));
    const targetH = Math.max(1, Math.round(origH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Image compression failed'))),
        'image/jpeg',
        quality
      );
    });
    return { blob, width: origW, height: origH };
  };

  const processUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(f.name)
    );

    if (files.length === 0) {
      setUploadStatus({
        type: 'error',
        message: 'No valid image files selected (supports JPG, PNG, WEBP).',
      });
      return;
    }

    const targetEventId = selectedEventId || (events[0] && events[0].id);
    if (!targetEventId) {
      setUploadStatus({
        type: 'error',
        message: 'Please create or select an active wedding event before uploading.',
      });
      return;
    }

    setUploading(true);
    setUploadStatus({
      type: 'info',
      message: `Starting batch upload of ${files.length} photos...`,
    });

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let lastErrorMsg = '';
    const DIRECT_THRESHOLD_BYTES = 3.2 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const percent = Math.round(((i + 1) / files.length) * 100);

      setUploadProgress({
        current: i + 1,
        total: files.length,
        currentFile: file.name,
        percent,
      });

      const formData = new FormData();
      formData.append('eventId', targetEventId);
      formData.append('source', 'MANUAL_BATCH');
      formData.append('sourceDevice', 'Web Batch Uploader');

      try {
        if (file.size > DIRECT_THRESHOLD_BYTES) {
          const sha256 = await computeFileSha256(file);
          const sessionRes = await fetch('/api/upload/gdrive-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-camera-ingest-key': 'ss_cam_ingest_key_wedding_2026',
            },
            body: JSON.stringify({
              eventId: targetEventId,
              filename: file.name,
              mimeType: file.type || 'image/jpeg',
              fileSize: file.size,
              sha256,
            }),
          });

          const sessionData = await sessionRes.json().catch(() => ({}));
          if (sessionRes.ok && sessionData.duplicate) {
            duplicateCount++;
            continue;
          }

          let originalDriveFileId = '';
          let originalSafeFilename = '';

          if (sessionRes.ok && sessionData.gdriveConfigured && sessionData.uploadUrl) {
            const putRes = await fetch(sessionData.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type || 'image/jpeg' },
              body: file,
            });
            if (putRes.ok) {
              const driveFile = await putRes.json().catch(() => ({}));
              if (driveFile.id) {
                originalDriveFileId = driveFile.id;
                originalSafeFilename = sessionData.safeFilename || file.name;
              }
            }
          }

          const webImg = await createWebOptimizedImage(file);
          formData.append('file', webImg.blob, file.name);
          formData.append('originalSha256', sha256);
          formData.append('originalFilename', file.name);
          formData.append('originalFileSize', String(file.size));
          formData.append('originalWidth', String(webImg.width));
          formData.append('originalHeight', String(webImg.height));
          if (originalDriveFileId) {
            formData.append('originalDriveFileId', originalDriveFileId);
            formData.append('originalSafeFilename', originalSafeFilename);
          }
        } else {
          formData.append('file', file);
        }

        const res = await fetch('/api/upload/ingest', {
          method: 'POST',
          headers: {
            'x-camera-ingest-key': 'ss_cam_ingest_key_wedding_2026',
          },
          body: formData,
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          if (data.duplicate) {
            duplicateCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
          lastErrorMsg = data.error || `Server returned ${res.status}`;
        }
      } catch (err: any) {
        errorCount++;
        lastErrorMsg = err.message || 'Network error';
      }
    }

    setUploading(false);
    setUploadProgress(null);

    if (errorCount === 0) {
      setUploadStatus({
        type: 'success',
        message: ` Successfully ingested ${successCount} photos (${duplicateCount} duplicates skipped). Faces detected & synced to Cloud!`,
      });
    } else {
      setUploadStatus({
        type: errorCount < files.length ? 'info' : 'error',
        message: `Processed: ${successCount} uploaded, ${duplicateCount} duplicates, ${errorCount} errors (${lastErrorMsg})`,
      });
    }

    fetchPhotos();
    setTimeout(() => setUploadStatus(null), 8000);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadFiles(e.target.files);
    }
    // Reset file input so same files can be re-selected if needed
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadFiles(e.dataTransfer.files);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (!confirm('Are you sure you want to delete this photo from the Vault and Cloud Storage?')) return;
    try {
      const res = await fetch('/api/photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setPhotos(photos.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1C1C1C] pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-brand-400 font-semibold font-sans">
            Curated Vault
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-1">
            Photo Management & Ingestion
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Upload wedding photos via Web Batch Upload or Camera Tethering. All photos are auto-indexed with AI & synced to Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Event Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-neutral-400">Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-brand-500"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({evt.photoCount || 0} photos)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg shadow-brand-500/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Batch Photos</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragging
          ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
          : 'border-[#262626] hover:border-brand-500/50 bg-[#111111]/60'
          }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 border border-brand-500/20">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Drag & Drop Wedding Photos Here, or <span className="text-brand-400 underline">Browse Files</span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Supports batch uploading hundreds of high-res photos (JPG, PNG). AI face detection and watermarking will run automatically.
            </p>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-neutral-500">
            <span>• Automatic Face Recognition</span>
            <span>• Google Drive Cloud Mirror</span>
            <span>• Duplicate Filtering</span>
          </div>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress && (
        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-300">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
              <span>
                Uploading photo <strong>{uploadProgress.current}</strong> of <strong>{uploadProgress.total}</strong>:{' '}
                <span className="text-brand-300">{uploadProgress.currentFile}</span>
              </span>
            </div>
            <span className="font-mono text-brand-400 font-bold">{uploadProgress.percent}%</span>
          </div>
          <div className="w-full bg-[#202020] rounded-full h-2 overflow-hidden">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Status Alert */}
      {uploadStatus && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between ${uploadStatus.type === 'success'
            ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
            : uploadStatus.type === 'error'
              ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
              : 'bg-brand-500/10 border border-brand-500/30 text-brand-300'
            }`}
        >
          <div className="flex items-center space-x-2">
            {uploadStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : uploadStatus.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />
            )}
            <span>{uploadStatus.message}</span>
          </div>
        </div>
      )}

      {/* Photo Grid or Empty State */}
      {loading ? (
        <div className="text-center py-20 text-neutral-500 text-xs flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading Vault photos...</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-20 border border-[#1F1F1F] rounded-2xl bg-[#111111]/40 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#181818] border border-[#2A2A2A] flex items-center justify-center text-neutral-500">
            <ImageIcon className="w-8 h-8 text-neutral-400" />
          </div>
          <div>
            <h3 className="text-base font-serif font-bold text-white">Vault Is Empty & Ready</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">
              All test photos have been cleaned out. You can now upload new wedding photographs using the button above or by shooting directly with a tethered camera.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative rounded-2xl overflow-hidden bg-[#141414] border border-[#222222] aspect-square"
            >
              <Image
                src={photo.thumbnailUrl || photo.previewUrl}
                alt={photo.filename}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Face Count Badge */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 border border-white/10 backdrop-blur-md text-white text-[10px] flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-brand-400" />
                <span>
                  {photo.faceCount} face{photo.faceCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Actions on Hover */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-[#AAAAAA] truncate max-w-[120px]">
                  {photo.filename}
                </span>

                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                  title="Delete Photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
