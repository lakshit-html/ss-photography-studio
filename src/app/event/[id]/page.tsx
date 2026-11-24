'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import {
  Camera,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Lock,
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldCheck,
  Share2,
} from 'lucide-react';

interface EventData {
  id: string;
  title: string;
  slug: string;
  brideName?: string;
  groomName?: string;
  eventDate: string;
  location?: string;
  coverPhoto?: string;
  description?: string;
  allowGuestDownloads: boolean;
  downloadWatermarkedOnly: boolean;
  photos: PhotoItem[];
}

interface PhotoItem {
  id: string;
  filename: string;
  originalUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  fileSize: number;
  width?: number;
  height?: number;
  faceCount: number;
  similarityScore?: number;
}

export default function GuestEventPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guest Face Search State
  const [isSearching, setIsSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [searchStep, setSearchStep] = useState<'IDLE' | 'CAPTURE' | 'PROCESSING' | 'RESULTS'>('IDLE');
  const [matchedPhotos, setMatchedPhotos] = useState<PhotoItem[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'MATCHES' | 'ALL'>('MATCHES');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Fetch Event Details
  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) throw new Error('Event not found or has expired.');
        const data = await res.json();
        setEvent(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load wedding gallery');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [id]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      setSearchStep('CAPTURE');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraActive(false);
      alert('Camera access was not granted. You can still upload a selfie from your photo library!');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureSelfieFromVideo = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Capture natural optical orientation for neural face embedding
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    stopCamera();
    processSelfie(base64);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      stopCamera();
      processSelfie(base64);
    };
    reader.readAsDataURL(file);
  };

  const processSelfie = async (selfieBase64: string) => {
    try {
      setIsSearching(true);
      setSearchStep('PROCESSING');
      setSearchMessage(null);

      const formData = new FormData();
      formData.append('eventId', event?.id || id);
      formData.append('selfieBase64', selfieBase64);
      formData.append('threshold', '0.42'); // Optimal calibrated sensitivity for 5-point aligned SFace

      const res = await fetch('/api/face/match', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Face search failed.');
      }

      setMatchedPhotos(data.matches || []);
      setSearchStep('RESULTS');
      setActiveTab('MATCHES');

      if (data.matches && data.matches.length > 0) {
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#B88E56', '#FFFFFF'],
        });
      } else {
        setSearchMessage(data.message || 'No photos found matching your face in this event yet.');
      }
    } catch (err: any) {
      setSearchStep('IDLE');
      alert(err.message || 'Face detection error. Please try another selfie.');
    } finally {
      setIsSearching(false);
    }
  };

  const downloadSinglePhoto = async (photo: PhotoItem) => {
    const downloadUrl = photo.originalUrl || photo.previewUrl;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${event?.slug || 'wedding'}_${photo.filename}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllMatchedZip = async () => {
    if (matchedPhotos.length === 0) return;
    try {
      setIsZipping(true);
      const zip = new JSZip();
      const folder = zip.folder(`${event?.slug || 'wedding'}-my-photos`);

      for (let i = 0; i < matchedPhotos.length; i++) {
        const p = matchedPhotos[i];
        const url = p.originalUrl || p.previewUrl;
        const res = await fetch(url);
        const blob = await res.blob();
        folder?.file(p.filename, blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `${event?.slug || 'wedding'}-my-photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('ZIP error:', err);
      alert('Failed to bundle photos into ZIP. You can still download photos individually.');
    } finally {
      setIsZipping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
        <p className="font-serif text-lg tracking-widest text-[#AAAAAA]">ACCESSING WEDDING GALLERY...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h1 className="font-serif text-2xl font-bold">Gallery Unavailable</h1>
        <p className="text-xs text-[#888888] max-w-sm">{error || 'This wedding gallery could not be found.'}</p>
        <Link href="/" className="px-6 py-2.5 rounded-full bg-brand-500 text-white text-xs uppercase tracking-widest">
          Return Home
        </Link>
      </div>
    );
  }

  const dateFormatted = new Date(event.eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Top Banner Branding */}
      <header className="border-b border-[#1F1F1F] bg-[#0D0D0D]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 text-xs uppercase tracking-widest text-[#888888] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">SS Photography</span>
        </Link>
        <div className="text-center">
          <span className="font-serif text-sm sm:text-base font-bold tracking-[0.2em] text-white">
            SS PHOTOGRAPHY
          </span>
          <p className="text-[9px] uppercase tracking-[0.3em] text-brand-400 font-sans">
            AI Guest Gallery
          </p>
        </div>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: event.title, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Gallery link copied to clipboard!');
            }
          }}
          className="p-2 rounded-full bg-[#181818] text-[#AAAAAA] hover:text-white"
          title="Share Gallery Link"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* Event Hero */}
      <section className="relative min-h-[45vh] sm:min-h-[55vh] flex items-end overflow-hidden pb-12">
        <div className="absolute inset-0 z-0">
          <Image
            src={event.coverPhoto || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80'}
            alt={event.title}
            fill
            priority
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 w-full space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/40 backdrop-blur-md text-brand-300 text-[10px] uppercase tracking-widest font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nikon D750 AI Gallery</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white tracking-tight">
            {event.title}
          </h1>

          {(event.brideName || event.groomName) && (
            <p className="font-serif text-xl sm:text-2xl italic text-brand-300">
              {event.brideName} {event.groomName ? `& ${event.groomName}` : ''}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#AAAAAA] pt-1">
            <span className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-brand-400" />
              <span>{dateFormatted}</span>
            </span>
            {event.location && (
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-brand-400" />
                <span>{event.location}</span>
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Main Interactive Action: Find My Photos */}
      <main className="max-w-5xl mx-auto px-6 py-8 w-full space-y-12 flex-1">
        {/* Face Recognition Discovery Box */}
        <section className="rounded-3xl bg-gradient-to-b from-[#161616] to-[#101010] border border-[#262626] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

          {searchStep === 'IDLE' && (
            <div className="text-center max-w-xl mx-auto space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  Find Your Photos Instantly
                </h2>
                <p className="text-xs sm:text-sm text-[#888888] leading-relaxed">
                  Take a quick selfie or upload a photo of yourself. Our AI will search all {event.photos.length} wedding photographs and show only the photos you appear in!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <button
                  onClick={startCamera}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-4 rounded-full bg-brand-500 text-white font-medium text-xs uppercase tracking-widest hover:bg-brand-400 shadow-xl shadow-brand-500/20 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Live Selfie</span>
                </button>

                <label className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-4 rounded-full border border-[#333333] bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:border-brand-500 cursor-pointer transition-all">
                  <Upload className="w-4 h-4 text-brand-400" />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="pt-4 flex items-center justify-center space-x-2 text-[11px] text-[#666666]">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span>Privacy Guarantee: Your selfie is never stored and is used solely for instant in-memory matching.</span>
              </div>
            </div>
          )}

          {/* Camera Capture View */}
          {searchStep === 'CAPTURE' && (
            <div className="flex flex-col items-center space-y-6">
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden border-4 border-brand-500/80 shadow-2xl bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {/* Face Framing Overlay Guide */}
                <div className="absolute inset-4 rounded-full border-2 border-dashed border-white/40 pointer-events-none" />
              </div>

              <p className="text-xs text-[#888888] tracking-wider uppercase">
                Align your face inside the circle in good lighting
              </p>

              <div className="flex items-center space-x-4">
                <button
                  onClick={captureSelfieFromVideo}
                  className="px-8 py-3.5 rounded-full bg-brand-500 text-white font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/20"
                >
                  Snap & Find Photos
                </button>

                <button
                  onClick={() => {
                    stopCamera();
                    setSearchStep('IDLE');
                  }}
                  className="px-6 py-3.5 rounded-full bg-[#222222] text-[#AAAAAA] hover:text-white text-xs uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* AI Processing Scanning View */}
          {searchStep === 'PROCESSING' && (
            <div className="py-16 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500/20 animate-ping duration-1000" />
                <div className="w-20 h-20 rounded-full bg-brand-500/10 border-2 border-brand-400 flex items-center justify-center text-brand-400">
                  <Sparkles className="w-8 h-8 animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-2xl font-bold text-white">Scanning Event Gallery</h3>
                <p className="text-xs text-[#888888] tracking-widest uppercase">
                  Extracting 128D facial features & matching against wedding captures...
                </p>
              </div>
            </div>
          )}

          {/* Results Summary Bar */}
          {searchStep === 'RESULTS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#222222] pb-6">
                <div>
                  <div className="inline-flex items-center space-x-2 text-brand-400 text-xs font-semibold uppercase tracking-widest">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Facial Search Complete</span>
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-white mt-1">
                    {matchedPhotos.length > 0
                      ? `We found ${matchedPhotos.length} photo${matchedPhotos.length > 1 ? 's' : ''} of you!`
                      : 'No Matches Found'}
                  </h3>
                </div>

                <div className="flex items-center space-x-3">
                  {matchedPhotos.length > 0 && (
                    <button
                      onClick={downloadAllMatchedZip}
                      disabled={isZipping}
                      className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 transition-all flex items-center space-x-1.5 shadow-lg"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isZipping ? 'Bundling ZIP...' : 'Download All (.ZIP)'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMatchedPhotos([]);
                      setSearchStep('IDLE');
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#222222] text-[#AAAAAA] hover:text-white text-xs uppercase tracking-widest transition-all flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Another Selfie</span>
                  </button>
                </div>
              </div>

              {searchMessage && (
                <div className="p-4 rounded-xl bg-[#1C1612] border border-brand-500/30 text-xs text-brand-300 text-center">
                  {searchMessage}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Private Matched Gallery Header */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-4">
          <div className="flex items-center space-x-3">
            <span className="font-serif text-lg font-bold text-amber-400">
              {searchStep === 'RESULTS'
                ? `Your Matched Photos (${matchedPhotos.length})`
                : 'Personalized Guest Gallery'}
            </span>
          </div>

          <span className="text-[11px] text-[#666666] uppercase tracking-widest hidden sm:inline">
            Private Face Match
          </span>
        </div>

        {/* Gallery Photo Grid — Strict Privacy: Only matched photos are shown */}
        {searchStep !== 'RESULTS' ? (
          <div className="py-16 px-6 text-center space-y-4 rounded-3xl bg-[#141414] border border-[#222222] max-w-2xl mx-auto shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-2xl font-bold text-white">Private Photo Delivery</h4>
            <p className="text-xs sm:text-sm text-[#888888] max-w-md mx-auto leading-relaxed">
              For complete privacy of the wedding couple and attendees, this gallery is strictly personalized. 
              Take a live selfie or upload your picture above to discover and download only the photographs you appear in.
            </p>
          </div>
        ) : matchedPhotos.length === 0 ? (
          <div className="py-16 text-center space-y-3 rounded-2xl bg-[#141414] border border-[#222222]">
            <Camera className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="text-sm font-semibold text-white">No Matching Photos Found</h4>
            <p className="text-xs text-[#888888] max-w-sm mx-auto">
              We couldn't detect your face in the current wedding pictures. Please try another clear selfie with good lighting, or check back soon as more captures are uploaded!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {matchedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative rounded-xl overflow-hidden bg-[#141414] border border-[#222222] aspect-square cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
              >
                <Image
                  src={photo.thumbnailUrl || photo.previewUrl}
                  alt={photo.filename}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Confidence Badge */}
                {photo.similarityScore && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-black font-bold text-[9px] uppercase tracking-wider backdrop-blur-md">
                    {Math.round(photo.similarityScore * 100)}% Match
                  </div>
                )}

                {/* Hover Actions */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-[#AAAAAA] truncate">{photo.filename}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSinglePhoto(photo);
                    }}
                    className="p-1.5 rounded-full bg-white text-black hover:bg-amber-400 transition-colors shadow-md"
                    title="Download Photo"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox High-Resolution Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center space-y-4">
            <div className="relative w-full h-[70vh] rounded-xl overflow-hidden">
              <Image
                src={selectedPhoto.previewUrl || selectedPhoto.originalUrl}
                alt={selectedPhoto.filename}
                fill
                className="object-contain"
              />
            </div>
            <div className="flex items-center justify-between w-full px-4">
              <div>
                <p className="font-serif text-lg font-bold text-white">{selectedPhoto.filename}</p>
                <p className="text-[11px] text-[#888888]">
                  Captured on Nikon D750 • {event.title}
                </p>
              </div>
              <button
                onClick={() => downloadSinglePhoto(selectedPhoto)}
                className="px-6 py-2.5 rounded-full bg-brand-500 text-white font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 transition-all flex items-center space-x-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#1C1C1C] py-8 text-center text-xs text-[#555555]">
        <p>SS Photography Smart Wedding Delivery System • Nikon D750 Ingest</p>
      </footer>
    </div>
  );
}
