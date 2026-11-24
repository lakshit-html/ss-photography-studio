'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Download, Printer, Sparkles, ExternalLink } from 'lucide-react';

export default function AdminPostersPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        if (data.length > 0) setSelectedEventId(data[0].id);
      });
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto w-full space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1C1C1C] pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-brand-400 font-semibold font-sans">
            Print & Physical Collateral
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mt-1">
            Wedding Table Easel QR Posters
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-[#141414] border border-[#222222] text-white text-xs focus:outline-none focus:border-brand-500"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>

          {selectedEvent && (
            <a
              href={`/api/events/${selectedEvent.id}/qr?format=poster`}
              download
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 shadow-lg shadow-brand-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download Vector Poster (SVG)</span>
            </a>
          )}
        </div>
      </div>

      {selectedEvent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Printable Poster Visual Preview */}
          <div className="lg:col-span-7 rounded-3xl bg-[#141414] border border-[#222222] p-8 flex flex-col items-center">
            <div className="w-full max-w-md bg-[#FAF8F5] text-[#111111] rounded-2xl shadow-2xl p-8 border border-[#E5DEC9] space-y-8 text-center relative overflow-hidden">
              <div className="absolute inset-2 border border-[#E5DEC9] pointer-events-none rounded-xl" />

              <div className="space-y-1 pt-2">
                <p className="font-serif text-sm font-bold tracking-[0.25em] text-[#111111]">
                  SS PHOTOGRAPHY
                </p>
                <p className="text-[9px] uppercase tracking-[0.3em] text-brand-600 font-semibold font-sans">
                  LUXURY WEDDING MEMORIES
                </p>
                <div className="w-12 h-[1px] bg-brand-500 mx-auto mt-2" />
              </div>

              <div className="space-y-1">
                <h3 className="font-serif text-2xl font-bold uppercase tracking-wider text-[#111111]">
                  {selectedEvent.title}
                </h3>
                <p className="text-[10px] uppercase tracking-widest text-[#777777]">
                  {new Date(selectedEvent.eventDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  • {selectedEvent.location || 'Wedding Celebration'}
                </p>
              </div>

              {/* QR Code */}
              <div className="w-48 h-48 mx-auto p-3 bg-white rounded-xl shadow-lg border border-[#EAE6DF] flex items-center justify-center">
                {selectedEvent.qrCodeDataUrl ? (
                  <img
                    src={selectedEvent.qrCodeDataUrl}
                    alt="Event QR"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-24 h-24 text-gray-400" />
                )}
              </div>

              <div className="space-y-1.5 pb-2">
                <p className="font-serif text-lg font-bold text-[#111111]">
                  Find Your Wedding Photos
                </p>
                <p className="text-[11px] text-[#555555] leading-relaxed">
                  1. Scan this QR code with your smartphone camera
                  <br />
                  2. Take a quick selfie on the gallery page
                  <br />
                  3. AI will instantly discover all your photos!
                </p>
              </div>
            </div>
          </div>

          {/* Printing Guidelines & Specs */}
          <div className="lg:col-span-5 rounded-3xl bg-[#111111] border border-[#222222] p-8 space-y-6">
            <h3 className="font-serif text-xl font-bold text-white">Printing Instructions</h3>

            <div className="space-y-4 text-xs text-[#888888] leading-relaxed">
              <p>
                This poster is pre-formatted in high-resolution vector format, making it suitable for:
              </p>

              <ul className="space-y-2 list-disc list-inside text-[#CCCCCC]">
                <li><strong>Table Easels:</strong> 5" x 7" or 8" x 10" table stand displays.</li>
                <li><strong>Welcome Entry Easel:</strong> A3 or A4 foam board prints at the venue entrance.</li>
                <li><strong>Bar & Buffet Displays:</strong> Compact table tents for guest awareness.</li>
              </ul>

              <p>
                For best luxury appearance, print on <strong>300 GSM textured ivory or matte linen cardstock</strong>.
              </p>
            </div>

            <div className="pt-4 border-t border-[#222222] space-y-3">
              <a
                href={`/api/events/${selectedEvent.id}/qr?format=poster`}
                download
                className="w-full py-3.5 rounded-full bg-brand-500 text-white font-semibold text-xs uppercase tracking-widest hover:bg-brand-400 transition-all flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Printable Poster</span>
              </a>

              <a
                href={`/api/events/${selectedEvent.id}/qr?format=png`}
                download
                className="w-full py-3 rounded-full bg-[#1A1A1A] text-[#AAAAAA] hover:text-white font-semibold text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border border-[#2A2A2A]"
              >
                <QrCode className="w-4 h-4" />
                <span>Download Raw QR Code Only (PNG)</span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-[#666666]">No wedding event selected.</div>
      )}
    </div>
  );
}
