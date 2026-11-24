'use client';

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderSync,
  Cpu,
  Wifi,
  Usb,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  BookOpen,
  Radio,
  FileCheck,
  Clock,
  Layers,
} from 'lucide-react';

export default function AdminTetherPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeEventTitle, setActiveEventTitle] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [guideTab, setGuideTab] = useState<'DIGICAM' | 'LIGHTROOM' | 'SDCARD'>('DIGICAM');
  const [uploaderStatus, setUploaderStatus] = useState<any>({
    isRunning: false,
    tetherDir: 'C:/Users/Suresh/Desktop/FaceReco/tether_inbox',
    activeEventTitle: '',
    detectedCount: 0,
    uploadedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    lastUploadedFile: null,
    recentLogs: [],
  });
  const [savingActiveEvent, setSavingActiveEvent] = useState(false);

  const fetchStatus = () => {
    fetch('/api/uploader/status')
      .then((res) => res.json())
      .then((data) => setUploaderStatus(data))
      .catch(() => {});
  };

  useEffect(() => {
    // Fetch events
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
      });

    // Fetch active event
    fetch('/api/uploader/active-event')
      .then((res) => res.json())
      .then((data) => {
        if (data.eventId) {
          setSelectedEventId(data.eventId);
          setActiveEventTitle(data.eventTitle);
        }
      });

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSetActiveEvent = async (eventId: string) => {
    try {
      setSavingActiveEvent(true);
      const res = await fetch('/api/uploader/active-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedEventId(eventId);
        setActiveEventTitle(data.activeEvent?.eventTitle || '');
        setSimulationLog((prev) => [
          `[EVENT UPDATED] Active camera ingest wedding set to: ${data.activeEvent?.eventTitle}`,
          ...prev,
        ]);
        fetchStatus();
      }
    } catch (err: any) {
      alert('Failed to set active event: ' + err.message);
    } finally {
      setSavingActiveEvent(false);
    }
  };

  const handleSimulateCapture = async () => {
    if (!selectedEventId) {
      alert('Please create or select an active wedding event first!');
      return;
    }

    try {
      setSimulating(true);
      const frameNum = Math.floor(Math.random() * 8000) + 1000;
      const filename = `DSC_${frameNum}_NikonD750.jpg`;
      setSimulationLog((prev) => [
        `[NIKON D750 TRIGGERED] Shutter 1/250s f/2.8 ISO 400 • Captured ${filename}`,
        ...prev,
      ]);

      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 1200;
      sampleCanvas.height = 800;
      const ctx = sampleCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1A1918';
        ctx.fillRect(0, 0, 1200, 800);
        ctx.fillStyle = '#C5A880';
        ctx.font = 'bold 36px Georgia';
        ctx.fillText('SS Photography • Nikon D750 Tether', 50, 80);
        ctx.fillStyle = '#FAF8F5';
        ctx.font = '24px monospace';
        ctx.fillText('Frame: ' + filename, 50, 130);
      }
      const testBlob = await new Promise<Blob | null>((resolve) =>
        sampleCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
      );

      if (!testBlob) throw new Error('Failed to render test frame');

      const formData = new FormData();
      formData.append('file', testBlob, filename);
      formData.append('eventId', selectedEventId);
      formData.append('source', 'CAMERA_TETHER');
      formData.append('sourceDevice', 'Nikon D750 (USB)');

      const res = await fetch('/api/upload/ingest', {
        method: 'POST',
        headers: {
          'x-camera-ingest-key': 'ss_cam_ingest_key_wedding_2026',
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setSimulationLog((prev) => [
          `[SUCCESS] ${filename} ingested! • SFace 128D Embeddings: ${data.photo?.faceCount || 0} faces • Watermarked preview ready`,
          ...prev,
        ]);
        fetchStatus();
      } else {
        setSimulationLog((prev) => [
          `[ERROR] Ingestion failed: ${data.error || 'Server error'}`,
          ...prev,
        ]);
      }
    } catch (err: any) {
      setSimulationLog((prev) => [`[ERROR] ${err.message}`, ...prev]);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs tracking-wider uppercase font-semibold">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Hardware Bridge & Live Ingest Monitor</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Nikon D750 Tethered Automation
          </h1>
          <p className="text-[#888888] text-sm mt-1">
            Continuous USB tethered ingestion via digiCamControl into SS Photography
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSimulateCapture}
            disabled={simulating || !selectedEventId}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs tracking-wide transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {simulating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span>{simulating ? 'Ingesting...' : 'Test Nikon Shutter'}</span>
          </button>
        </div>
      </div>

      {/* Live Uploader Telemetry & Status Banner */}
      <div className="p-6 rounded-2xl bg-[#141414] border border-[#2E2E2E] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
          <div className="flex items-center space-x-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                uploaderStatus.isRunning
                  ? 'bg-green-500 animate-ping'
                  : 'bg-amber-500'
              }`}
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">
                  Daemon Status:
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    uploaderStatus.isRunning
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {uploaderStatus.isRunning
                    ? 'Active & Listening for D750'
                    : 'Daemon Offline (Run: npm run uploader)'}
                </span>
              </div>
              <p className="text-xs text-[#777777] mt-0.5">
                Folder: <code className="text-amber-400/90 font-mono">{uploaderStatus.tetherDir}</code>
              </p>
            </div>
          </div>

          {/* Active Wedding Selector */}
          <div className="flex items-center space-x-3 bg-[#1A1A1A] p-2.5 rounded-xl border border-[#333333]">
            <span className="text-xs text-[#AAAAAA] font-medium whitespace-nowrap">
              Active Wedding:
            </span>
            <select
              value={selectedEventId}
              onChange={(e) => handleSetActiveEvent(e.target.value)}
              disabled={savingActiveEvent}
              className="bg-[#111111] border border-[#444444] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} {ev.brideName ? `(${ev.brideName} & ${ev.groomName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E]">
            <div className="flex items-center justify-between text-[#888888] text-xs">
              <span>Captures Detected</span>
              <Camera className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">
              {uploaderStatus.detectedCount || 0}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E]">
            <div className="flex items-center justify-between text-[#888888] text-xs">
              <span>Ingested & Indexed</span>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400 mt-2">
              {uploaderStatus.uploadedCount || 0}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E]">
            <div className="flex items-center justify-between text-[#888888] text-xs">
              <span>Pending in Queue</span>
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-2">
              {uploaderStatus.pendingCount || 0}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E]">
            <div className="flex items-center justify-between text-[#888888] text-xs">
              <span>Failed / Retrying</span>
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-400 mt-2">
              {uploaderStatus.failedCount || 0}
            </p>
          </div>
        </div>

        {/* Live Terminal Daemon Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[#888888]">
            <span>Uploader Console Stream</span>
            <span className="font-mono text-[10px]">Auto-refreshes every 3s</span>
          </div>
          <div className="p-4 rounded-xl bg-[#0C0C0C] border border-[#222222] font-mono text-xs text-[#CCCCCC] h-36 overflow-y-auto space-y-1">
            {uploaderStatus.recentLogs && uploaderStatus.recentLogs.length > 0 ? (
              uploaderStatus.recentLogs.map((lg: string, i: number) => (
                <p key={i} className={lg.includes('SUCCESS') ? 'text-green-400' : lg.includes('ERROR') || lg.includes('FAILED') ? 'text-red-400' : 'text-[#AAAAAA]'}>
                  {lg}
                </p>
              ))
            ) : (
              <p className="text-[#555555]">[STANDBY] Awaiting daemon connection. Start uploader with: npm run uploader</p>
            )}
          </div>
        </div>
      </div>

      {/* Step-by-Step Photographer Setup Guide */}
      <div className="p-6 rounded-2xl bg-[#141414] border border-[#2E2E2E] space-y-6">
        <div className="flex items-center justify-between border-b border-[#282828] pb-4">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Nikon D750 Hardware Tethering Guide</h3>
          </div>

          <div className="flex rounded-lg bg-[#1E1E1E] p-1 border border-[#333333]">
            <button
              onClick={() => setGuideTab('DIGICAM')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                guideTab === 'DIGICAM' ? 'bg-amber-500 text-black shadow' : 'text-[#888888] hover:text-white'
              }`}
            >
              digiCamControl (Free)
            </button>
            <button
              onClick={() => setGuideTab('LIGHTROOM')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                guideTab === 'LIGHTROOM' ? 'bg-amber-500 text-black shadow' : 'text-[#888888] hover:text-white'
              }`}
            >
              Lightroom Classic
            </button>
            <button
              onClick={() => setGuideTab('SDCARD')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                guideTab === 'SDCARD' ? 'bg-amber-500 text-black shadow' : 'text-[#888888] hover:text-white'
              }`}
            >
              SD Card / Wi-Fi
            </button>
          </div>
        </div>

        {/* Option A: digiCamControl */}
        {guideTab === 'DIGICAM' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-[#CCCCCC]">
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">1</span>
              <p className="font-bold text-white text-sm">Download digiCamControl</p>
              <p className="text-[#888888] leading-relaxed">
                Download the free open-source software from <strong>digicamcontrol.com</strong> and install it on your laptop.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">2</span>
              <p className="font-bold text-white text-sm">Connect Nikon D750 via USB</p>
              <p className="text-[#888888] leading-relaxed">
                Connect the camera using the standard Mini-B USB cable (UC-E6). Turn the camera on and set format to <strong>JPEG Fine</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">3</span>
              <p className="font-bold text-white text-sm">Set Auto-Save Folder</p>
              <p className="text-[#888888] leading-relaxed">
                In digiCamControl settings, set the download folder to:
              </p>
              <div className="p-2 bg-[#121212] border border-[#333333] rounded font-mono text-[10px] text-amber-400 break-all select-all">
                C:\Users\Suresh\Desktop\FaceReco\tether_inbox
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">4</span>
              <p className="font-bold text-white text-sm">Start Auto-Uploader</p>
              <p className="text-[#888888] leading-relaxed">
                In your terminal at the project folder, run:
              </p>
              <div className="p-2 bg-[#121212] border border-[#333333] rounded font-mono text-[11px] text-green-400 select-all">
                npm run uploader
              </div>
            </div>
          </div>
        )}

        {/* Option B: Lightroom */}
        {guideTab === 'LIGHTROOM' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#CCCCCC]">
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">1</span>
              <p className="font-bold text-white text-sm">Plug in Nikon D750</p>
              <p className="text-[#888888] leading-relaxed">
                Connect camera via USB. Open <strong>Lightroom Classic</strong> and choose <em>File &gt; Tethered Capture &gt; Start Tethered Capture</em>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">2</span>
              <p className="font-bold text-white text-sm">Set Auto-Save Folder</p>
              <p className="text-[#888888] leading-relaxed">
                Set Destination Folder to:
              </p>
              <div className="p-2 bg-[#121212] border border-[#333333] rounded font-mono text-[11px] text-amber-400 break-all select-all">
                C:\Users\Suresh\Desktop\FaceReco\tether_inbox
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">3</span>
              <p className="font-bold text-white text-sm">Run Background Uploader</p>
              <div className="p-2 bg-[#121212] border border-[#333333] rounded font-mono text-[11px] text-green-400 select-all">
                npm run uploader
              </div>
            </div>
          </div>
        )}

        {/* Option C: SD Card / Wi-Fi */}
        {guideTab === 'SDCARD' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#CCCCCC]">
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">1</span>
              <p className="font-bold text-white text-sm">Insert SD Card</p>
              <p className="text-[#888888] leading-relaxed">
                Insert your Nikon D750 SD card into your laptop card reader, OR connect via Nikon Wireless Mobile Utility.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">2</span>
              <p className="font-bold text-white text-sm">Copy Photos or Target SD Folder</p>
              <p className="text-[#888888] leading-relaxed">
                Copy photos into <code>tether_inbox</code>, or point the uploader directly to the card:
              </p>
              <div className="p-2 bg-[#121212] border border-[#333333] rounded font-mono text-[11px] text-amber-400 break-all select-all">
                npm run uploader -- --folder "D:\DCIM\100ND750"
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-xs">3</span>
              <p className="font-bold text-white text-sm">Instant Processing</p>
              <p className="text-[#888888] leading-relaxed">
                All photos are processed, deduplicated, and watermarked for the wedding event.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Manual Simulation Console */}
      <div className="rounded-2xl bg-[#141414] border border-[#2E2E2E] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Manual Ingest & Shutter Log</h3>
          <span className="text-xs text-[#777777]">Audit Trail</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0C0C0C] border border-[#222222] font-mono text-xs text-[#CCCCCC] h-36 overflow-y-auto space-y-1.5">
          {simulationLog.length === 0 ? (
            <p className="text-[#555555]">
              [STANDBY] Click "Test Nikon Shutter" above to trigger a test frame ingestion into the active wedding.
            </p>
          ) : (
            simulationLog.map((log, idx) => (
              <p
                key={idx}
                className={
                  log.includes('SUCCESS')
                    ? 'text-green-400 font-semibold'
                    : log.includes('ERROR')
                    ? 'text-red-400'
                    : 'text-[#AAAAAA]'
                }
              >
                {log}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
