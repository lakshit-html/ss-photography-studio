'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Plus,
  QrCode,
  ExternalLink,
  Trash2,
  RefreshCw,
  X,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Clock,
} from 'lucide-react';

interface WeddingEvent {
  id: string;
  title: string;
  slug: string;
  brideName?: string;
  groomName?: string;
  eventDate: string;
  location?: string;
  coverPhoto?: string;
  photoCount: number;
  usedStorageBytes: number;
  status: string;
  qrCodeDataUrl?: string;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    brideName: '',
    groomName: '',
    eventDate: new Date().toISOString().split('T')[0],
    location: '',
    coverPhoto: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80',
    description: '',
  });

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-camera-ingest-key': 'ss_cam_ingest_key_wedding_2026',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event. Please verify details.');
      }

      setModalOpen(false);
      setSuccessToast(`Wedding event "${formData.title}" created with QR code!`);
      setTimeout(() => setSuccessToast(null), 4000);

      // Reset form
      setFormData({
        title: '',
        brideName: '',
        groomName: '',
        eventDate: new Date().toISOString().split('T')[0],
        location: '',
        coverPhoto: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80',
        description: '',
      });

      fetchEvents();
    } catch (err: any) {
      setFormError(err.message || 'Error creating event');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}" and all its photos?`)) return;

    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          'x-camera-ingest-key': 'ss_cam_ingest_key_wedding_2026',
        },
        credentials: 'include',
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setSuccessToast(`Deleted "${title}"`);
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        alert('Failed to delete event');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2A] pb-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-amber-400 font-semibold font-sans">
            Studio Event Management
          </span>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Wedding Events
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchEvents}
            className="p-2.5 rounded-xl bg-[#1C1C1C] border border-[#333333] text-[#AAAAAA] hover:text-white transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setModalOpen(true);
            }}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-xs uppercase tracking-wider hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Wedding Event</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Events Table / List */}
      <div className="rounded-2xl bg-[#141414] border border-[#2E2E2E] overflow-hidden shadow-xl">
        {events.length === 0 && !loading ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1E1E1E] border border-[#333333] flex items-center justify-center text-amber-400 mx-auto">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">No Wedding Events Yet</h3>
            <p className="text-xs text-[#888888] max-w-sm mx-auto leading-relaxed">
              Create your first real wedding event to generate a unique guest QR code and start tethered camera ingestion.
            </p>
            <button
              onClick={() => {
                setFormError(null);
                setModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-xs uppercase tracking-wider hover:bg-amber-400"
            >
              Create First Event
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#282828] text-[#888888] uppercase text-[10px] tracking-wider bg-[#1A1A1A]">
                  <th className="py-4 px-6">Wedding Event</th>
                  <th className="py-4 px-4">Couple</th>
                  <th className="py-4 px-4">Date & Venue</th>
                  <th className="py-4 px-4">Ingested Photos</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {events.map((evt) => (
                  <tr key={evt.id} className="text-[#CCCCCC] hover:bg-[#1A1A1A]/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-semibold text-sm text-white">{evt.title}</p>
                      <p className="text-[10px] text-[#666666] font-mono">/event/{evt.slug}</p>
                    </td>
                    <td className="py-4 px-4">
                      {evt.brideName || evt.groomName ? (
                        <span className="text-amber-300 font-medium">
                          {evt.brideName} {evt.groomName ? `& ${evt.groomName}` : ''}
                        </span>
                      ) : (
                        <span className="text-[#666666]">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <p className="text-white">
                          {new Date(evt.eventDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-[11px] text-[#777777] truncate max-w-[180px]">
                          {evt.location || 'Venue TBD'}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-mono text-white font-bold">{evt.photoCount || 0}</span>
                      <span className="text-[#777777] text-[10px] ml-1">frames</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] uppercase tracking-wider font-semibold">
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/event/${evt.slug}`}
                          target="_blank"
                          className="p-2 rounded-lg bg-[#222222] text-[#AAAAAA] hover:text-white transition-colors"
                          title="Open Guest Discovery Gallery"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>

                        <a
                          href={`/api/events/${evt.id}/qr?format=png`}
                          download
                          className="p-2 rounded-lg bg-[#222222] text-[#AAAAAA] hover:text-amber-400 transition-colors"
                          title="Download QR Code PNG"
                        >
                          <QrCode className="w-4 h-4" />
                        </a>

                        <a
                          href={`/api/events/${evt.id}/qr?format=poster`}
                          download
                          className="p-2 rounded-lg bg-[#222222] text-[#AAAAAA] hover:text-amber-400 transition-colors"
                          title="Download Table Easel Poster (SVG)"
                        >
                          <Download className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          className="p-2 rounded-lg bg-[#222222] text-[#AAAAAA] hover:text-red-400 transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#181818] border border-[#333333] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-4">
              <h3 className="text-xl font-bold text-white">Create Wedding Event</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#888888] hover:text-white hover:bg-[#252525]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-[#CCCCCC] font-medium">Wedding / Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reception, Sangeet Night, Royal Palace Vows"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#222222] border border-[#3A3A3A] text-white text-xs placeholder:text-[#666666] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#CCCCCC] font-medium">Bride Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Priya"
                    value={formData.brideName}
                    onChange={(e) => setFormData({ ...formData, brideName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#222222] border border-[#3A3A3A] text-white text-xs placeholder:text-[#666666] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#CCCCCC] font-medium">Groom Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Raj"
                    value={formData.groomName}
                    onChange={(e) => setFormData({ ...formData, groomName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#222222] border border-[#3A3A3A] text-white text-xs placeholder:text-[#666666] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#CCCCCC] font-medium">Event Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#222222] border border-[#3A3A3A] text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#CCCCCC] font-medium">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="e.g. Shahi Bagh, Palace Grounds"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#222222] border border-[#3A3A3A] text-white text-xs placeholder:text-[#666666] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-[#CCCCCC] font-medium">Cover Photo URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.coverPhoto}
                  onChange={(e) => setFormData({ ...formData, coverPhoto: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#222222] border border-[#3A3A3A] text-white text-xs placeholder:text-[#666666] focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#2A2A2A] text-[#AAAAAA] hover:text-white text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-xs uppercase tracking-wider hover:bg-amber-400 disabled:opacity-50"
                >
                  {submitting ? 'Creating Event...' : 'Create Wedding & QR Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
