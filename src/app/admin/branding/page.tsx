'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Stamp, Upload, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

export default function AdminBrandingPage() {
  const [opacity, setOpacity] = useState(0.75);
  const [sizePercentage, setSizePercentage] = useState(16);
  const [position, setPosition] = useState('BOTTOM_RIGHT');
  const [allowOriginalDownload, setAllowOriginalDownload] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/branding')
      .then((res) => res.json())
      .then((data) => {
        if (data.opacity) setOpacity(data.opacity);
        if (data.sizePercentage) setSizePercentage(data.sizePercentage);
        if (data.position) setPosition(data.position);
        if (data.allowOriginalDownload !== undefined) setAllowOriginalDownload(data.allowOriginalDownload);
      });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opacity,
          sizePercentage,
          position,
          allowOriginalDownload,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto w-full space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1C1C1C] pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-brand-400 font-semibold font-sans">
            Studio Identity
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-1">
            Branding & Watermark
          </h1>
        </div>

        {savedSuccess && (
          <div className="flex items-center space-x-2 text-green-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Watermark settings updated across events!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Form */}
        <div className="lg:col-span-5 rounded-3xl bg-[#111111] border border-[#222222] p-8 space-y-6">
          <h3 className="font-serif text-xl font-bold text-white">Watermark Configuration</h3>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Opacity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#AAAAAA]">Watermark Opacity</span>
                <span className="font-mono text-brand-400 font-bold">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-brand-500 cursor-pointer"
              />
            </div>

            {/* Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#AAAAAA]">Watermark Size Ratio</span>
                <span className="font-mono text-brand-400 font-bold">{sizePercentage}% of photo width</span>
              </div>
              <input
                type="range"
                min="8"
                max="25"
                step="1"
                value={sizePercentage}
                onChange={(e) => setSizePercentage(parseInt(e.target.value, 10))}
                className="w-full accent-brand-500 cursor-pointer"
              />
            </div>

            {/* Watermark Position */}
            <div className="space-y-2">
              <label className="text-xs text-[#AAAAAA] block">Watermark Placement</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Bottom Right (Default)', val: 'BOTTOM_RIGHT' },
                  { label: 'Bottom Left', val: 'BOTTOM_LEFT' },
                  { label: 'Top Right', val: 'TOP_RIGHT' },
                  { label: 'Center', val: 'CENTER' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setPosition(item.val)}
                    className={`py-2.5 px-3 rounded-xl border text-center transition-all ${
                      position === item.val
                        ? 'bg-brand-500/20 border-brand-500 text-brand-300 font-semibold'
                        : 'bg-[#161616] border-[#262626] text-[#888888] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Original Download Toggle */}
            <div className="pt-2 border-t border-[#222222] space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOriginalDownload}
                  onChange={(e) => setAllowOriginalDownload(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded"
                />
                <span className="text-xs text-[#CCCCCC]">
                  Allow guests to download unwatermarked high-res original photos
                </span>
              </label>
              <p className="text-[11px] text-[#666666] pl-7">
                When unchecked, guests can only download the preview with the SS Photography studio watermark.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-full bg-brand-500 text-white font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/20"
            >
              {saving ? 'Saving...' : 'Save Branding Guard'}
            </button>
          </form>
        </div>

        {/* Live Preview Display */}
        <div className="lg:col-span-7 rounded-3xl bg-[#111111] border border-[#222222] p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-bold text-white">Live Watermark Preview</h3>
            <span className="text-xs text-brand-400 font-mono">Lossless Preview Overlay</span>
          </div>

          <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-black border border-[#222222]">
            <Image
              src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
              alt="Preview"
              fill
              className="object-cover"
            />

            {/* Dynamic Watermark Indicator */}
            <div
              className={`absolute transition-all duration-300 pointer-events-none p-3 ${
                position === 'BOTTOM_RIGHT'
                  ? 'bottom-4 right-4'
                  : position === 'BOTTOM_LEFT'
                  ? 'bottom-4 left-4'
                  : position === 'TOP_RIGHT'
                  ? 'top-4 right-4'
                  : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
              }`}
              style={{ opacity }}
            >
              <div className="px-3.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/20 text-center">
                <p className="font-serif text-sm font-bold text-white tracking-[0.2em]">SS PHOTOGRAPHY</p>
                <p className="text-[8px] uppercase tracking-[0.25em] text-brand-300 font-sans">
                  Luxury Wedding Atelier
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-[#666666] pt-2">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <span>
              Original photos are ALWAYS preserved 100% untouched in high-resolution archival storage.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
