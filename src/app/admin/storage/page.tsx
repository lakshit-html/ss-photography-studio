'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Globe,
  Wifi,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  FolderLock,
  ArrowUpRight,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

export default function AdminStoragePage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [hostConfig, setHostConfig] = useState<any>(null);
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingUrl, setUpdatingUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [storageRes, tunnelRes] = await Promise.all([
        fetch('/api/storage/metrics'),
        fetch('/api/tunnel'),
      ]);

      if (storageRes.ok) {
        const data = await storageRes.json();
        setMetrics(data);
      }

      if (tunnelRes.ok) {
        const tData = await tunnelRes.json();
        setHostConfig(tData);
        setInputUrl(tData.activeUrl || '');
      }
    } catch (err: any) {
      console.error('Failed to load storage/tunnel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateHostUrl = async (urlToSave?: string, mode: string = 'CUSTOM') => {
    const finalUrl = urlToSave || inputUrl;
    if (!finalUrl) return;

    try {
      setUpdatingUrl(true);
      const res = await fetch('/api/tunnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUrl: finalUrl, mode }),
      });

      const data = await res.json();
      if (res.ok) {
        setHostConfig(data.config);
        setInputUrl(data.config.activeUrl);
        setStatusMessage(data.message || 'Host URL successfully updated!');
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        alert(data.error || 'Failed to update host URL');
      }
    } catch (err: any) {
      alert('Error updating host: ' + err.message);
    } finally {
      setUpdatingUrl(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const formatMB = (bytes: number) => {
    if (!bytes) return '0.00 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs tracking-wider uppercase font-semibold">
            <Server className="w-4 h-4" />
            <span>Zero-Cost Server & Storage Infrastructure</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-white mt-1">
            Storage & Guest Access
          </h1>
          <p className="text-[#888888] text-sm mt-1">
            100% Free permanent local SSD storage with zero-credit-card guest tunneling
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] border border-[#333333] text-xs font-semibold text-white transition-all self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs flex items-center space-x-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Top Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-[#888888] text-xs">
            <span>Storage Engine</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2">Local Computer SSD</p>
          <p className="text-[11px] text-green-400 font-mono mt-1">
            ✔ $0.00 / mo • Zero Limits
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-[#888888] text-xs">
            <span>Total Storage Consumed</span>
            <FolderLock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2">
            {formatMB(metrics?.totalBytes || 0)}
          </p>
          <p className="text-[11px] text-[#777777] mt-1">
            Originals + Previews + Thumbs
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-[#888888] text-xs">
            <span>Guest Access Mode</span>
            <Globe className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-white mt-2">
            {hostConfig?.mode === 'LOCAL_WIFI' ? 'Local Wi-Fi LAN' : 'Public Tunnel'}
          </p>
          <p className="text-[11px] text-amber-400/90 font-mono mt-1 truncate">
            {hostConfig?.activeUrl || 'http://localhost:3000'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626]">
          <div className="flex items-center justify-between text-[#888888] text-xs">
            <span>Privacy Boundary</span>
            <ShieldCheck className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-xl font-bold text-green-400 mt-2">Sealed & Gated</p>
          <p className="text-[11px] text-[#777777] mt-1">
            Originals outside public/
          </p>
        </div>
      </div>

      {/* Guest Remote Access & QR Host Controller */}
      <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Live Guest Host Controller</span>
            </div>
            <h2 className="text-lg font-serif font-bold text-white mt-0.5">
              Event QR Code Destination URL
            </h2>
            <p className="text-xs text-[#888888] mt-1">
              Every table easel QR code automatically encodes this exact domain. Guests scan it with their phone camera to open their gallery.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const lanUrl = `http://${hostConfig?.detectedLanIp || '192.168.1.1'}:3000`;
                handleUpdateHostUrl(lanUrl, 'LOCAL_WIFI');
              }}
              disabled={updatingUrl}
              className="px-3.5 py-2 rounded-xl bg-[#1E1E1E] hover:bg-[#282828] border border-[#333333] text-xs text-[#CCCCCC] font-semibold flex items-center space-x-2 transition-all"
            >
              <Wifi className="w-3.5 h-3.5 text-amber-400" />
              <span>Use Venue Wi-Fi (IP: {hostConfig?.detectedLanIp || 'Detecting...'})</span>
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="space-y-2">
          <label className="text-xs text-[#AAAAAA] font-semibold">
            Active Public or Local Domain (http:// or https://)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="e.g. https://ss-wedding.trycloudflare.com or http://192.168.1.150:3000"
              className="flex-1 bg-[#0D0D0D] border border-[#333333] rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={() => handleUpdateHostUrl()}
              disabled={updatingUrl}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold tracking-wide transition-all disabled:opacity-50"
            >
              {updatingUrl ? 'Updating QR Codes...' : 'Update All QR Codes'}
            </button>
          </div>
          <p className="text-[11px] text-[#666666]">
            Changing this domain instantly updates all existing and new wedding QR codes across posters, printables, and share links.
          </p>
        </div>

        {/* Free Remote Access Methods */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
            Three 100% Free Methods for Wedding Guests to Access Your Laptop (Zero Credit Card Required)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Method 1: Cloudflare Quick Tunnel */}
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">1. Cloudflare Quick Tunnel</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-[#888888] leading-relaxed">
                Cloudflare offers <strong>free permanent quick tunnels</strong> with zero credit card and zero account required. Generates an instant public HTTPS link.
              </p>
              <div className="p-2 rounded bg-[#101010] border border-[#2A2A2A] font-mono text-[11px] text-green-400 flex items-center justify-between">
                <span className="truncate">cloudflared tunnel --url http://localhost:3000</span>
                <button
                  onClick={() => copyToClipboard('cloudflared tunnel --url http://localhost:3000', 'cf')}
                  className="ml-2 text-[#777777] hover:text-white"
                >
                  {copiedCmd === 'cf' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Method 2: Open-Source LocalTunnel */}
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">2. Open-Source LocalTunnel</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold">
                  Zero Install
                </span>
              </div>
              <p className="text-[11px] text-[#888888] leading-relaxed">
                Runs directly via Node.js without installing any external binary. Free forever, no signup.
              </p>
              <div className="p-2 rounded bg-[#101010] border border-[#2A2A2A] font-mono text-[11px] text-blue-400 flex items-center justify-between">
                <span className="truncate">npx localtunnel --port 3000</span>
                <button
                  onClick={() => copyToClipboard('npx localtunnel --port 3000', 'lt')}
                  className="ml-2 text-[#777777] hover:text-white"
                >
                  {copiedCmd === 'lt' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Method 3: Venue Wi-Fi / Hotspot LAN */}
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#2E2E2E] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">3. Offline Hotspot Mode</span>
                <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-mono font-bold">
                  Zero Internet
                </span>
              </div>
              <p className="text-[11px] text-[#888888] leading-relaxed">
                For churches or remote outdoor venues with <strong>zero cellular internet</strong>. Connect phone hotspot or venue Wi-Fi:
              </p>
              <div className="p-2 rounded bg-[#101010] border border-[#2A2A2A] font-mono text-[11px] text-amber-400 flex items-center justify-between">
                <span className="truncate">http://{hostConfig?.detectedLanIp || '192.168.1.X'}:3000</span>
                <button
                  onClick={() => copyToClipboard(`http://${hostConfig?.detectedLanIp || '192.168.1.1'}:3000`, 'lan')}
                  className="ml-2 text-[#777777] hover:text-white"
                >
                  {copiedCmd === 'lan' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Architecture Breakdown */}
      <div className="p-6 rounded-2xl bg-[#141414] border border-[#262626] space-y-6">
        <div>
          <h2 className="text-lg font-serif font-bold text-white">
            Storage Directory Hierarchy & Breakdown
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">
            Strict separation between private uncompressed originals and watermarked web previews
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Originals */}
          <div className="p-5 rounded-xl bg-[#181818] border border-[#2E2E2E] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Private Originals
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-mono font-bold">
                Protected / Auth Gated
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatMB(metrics?.originalsBytes || 0)}
            </p>
            <p className="text-xs text-[#888888]">
              {metrics?.totalOriginalsCount || 0} high-resolution photographs
            </p>
            <div className="p-2 bg-[#101010] rounded font-mono text-[10px] text-[#888888] break-all select-all">
              storage/events/&#123;eventId&#125;/originals
            </div>
            <p className="text-[11px] text-[#777777]">
              Stored completely outside <code>public/</code>. Inaccessible via static URL. Downloadable only by admin or permitted events via <code>/api/photos/original</code>.
            </p>
          </div>

          {/* Previews */}
          <div className="p-5 rounded-xl bg-[#181818] border border-[#2E2E2E] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Watermarked Previews
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">
                Watermarked
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatMB(metrics?.previewsBytes || 0)}
            </p>
            <p className="text-xs text-[#888888]">
              {metrics?.totalPreviewsCount || 0} web-optimized previews
            </p>
            <div className="p-2 bg-[#101010] rounded font-mono text-[10px] text-[#888888] break-all select-all">
              public/uploads/&#123;eventId&#125;/previews
            </div>
            <p className="text-[11px] text-[#777777]">
              Non-destructive preview with photographer logo applied to bottom-right corner. Safe for guests to view on phones.
            </p>
          </div>

          {/* Thumbnails */}
          <div className="p-5 rounded-xl bg-[#181818] border border-[#2E2E2E] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Progressive Thumbnails
              </span>
              <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px] font-mono font-bold">
                Fast Mobile Grid
              </span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatMB(metrics?.thumbnailsBytes || 0)}
            </p>
            <p className="text-xs text-[#888888]">
              {metrics?.totalThumbnailsCount || 0} lightweight thumbnails
            </p>
            <div className="p-2 bg-[#101010] rounded font-mono text-[10px] text-[#888888] break-all select-all">
              public/uploads/&#123;eventId&#125;/thumbnails
            </div>
            <p className="text-[11px] text-[#777777]">
              400px progressive web crops that load instantly on guest mobile devices after face matching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
