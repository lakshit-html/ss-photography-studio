'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Image as ImageIcon,
  HardDrive,
  Camera,
  Sparkles,
  ArrowRight,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const totalEvents = stats?.events?.total ?? 0;
  const totalPhotos = stats?.photos?.total ?? 0;
  const facesIndexed = stats?.photos?.facesIndexed ?? 0;
  const usedMB = stats?.storage?.usedMB ?? 0;

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto w-full space-y-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-amber-400 font-semibold font-sans">
            Studio Management
          </span>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Studio Overview
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchStats}
            className="p-2.5 rounded-xl bg-[#1C1C1C] border border-[#333333] text-[#AAAAAA] hover:text-white"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/admin/events"
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-xs uppercase tracking-wider hover:bg-amber-400 shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Wedding Event</span>
          </Link>
        </div>
      </div>

      {/* Real KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Events */}
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#282828] space-y-2">
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-xs uppercase tracking-wider">Events</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white font-mono">{totalEvents}</p>
          <p className="text-[11px] text-[#666666]">
            {stats?.events?.active ?? 0} active galleries
          </p>
        </div>

        {/* Total Photos Ingested */}
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#282828] space-y-2">
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-xs uppercase tracking-wider">Camera Frames</span>
            <ImageIcon className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white font-mono">{totalPhotos}</p>
          <p className="text-[11px] text-[#666666]">Raw / JPG captures</p>
        </div>

        {/* Faces Indexed */}
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#282828] space-y-2">
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-xs uppercase tracking-wider">Faces Indexed</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-amber-300 font-mono">{facesIndexed}</p>
          <p className="text-[11px] text-[#666666]">Biometric search vectors</p>
        </div>

        {/* Storage Used */}
        <div className="p-6 rounded-2xl bg-[#141414] border border-[#282828] space-y-2">
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-xs uppercase tracking-wider">Storage Used</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white font-mono">{usedMB} MB</p>
          <p className="text-[11px] text-[#666666]">High-resolution vault</p>
        </div>
      </div>

      {/* Quick Launch & Ingestion Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-1 rounded-2xl bg-[#141414] border border-[#282828] p-6 space-y-4">
          <h3 className="text-base font-bold text-white">Studio Workflows</h3>

          <div className="space-y-3">
            <Link
              href="/admin/events"
              className="flex items-center justify-between p-4 rounded-xl bg-[#1A1A1A] border border-[#333333] hover:border-amber-500/50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                    Wedding Events
                  </p>
                  <p className="text-[10px] text-[#777777]">Create & manage QR galleries</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#666666] group-hover:text-white" />
            </Link>

            <Link
              href="/admin/tether"
              className="flex items-center justify-between p-4 rounded-xl bg-[#1A1A1A] border border-[#333333] hover:border-amber-500/50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                    Nikon D750 Tether Hub
                  </p>
                  <p className="text-[10px] text-[#777777]">Live folder watcher & ingestion</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#666666] group-hover:text-white" />
            </Link>

            <Link
              href="/admin/photos"
              className="flex items-center justify-between p-4 rounded-xl bg-[#1A1A1A] border border-[#333333] hover:border-amber-500/50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                    Batch Upload
                  </p>
                  <p className="text-[10px] text-[#777777]">Drag & drop photo vault</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#666666] group-hover:text-white" />
            </Link>
          </div>
        </div>

        {/* Live Ingestion Stream */}
        <div className="lg:col-span-2 rounded-2xl bg-[#141414] border border-[#282828] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Camera Ingestion Stream</h3>
            <span className="flex items-center space-x-1.5 text-[10px] uppercase tracking-wider text-green-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Daemon Ready</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#2A2A2A] text-[#777777] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-2">Filename</th>
                  <th className="py-3 px-2">Target Event</th>
                  <th className="py-3 px-2">Device</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202020]">
                {stats?.recentIngestions && stats.recentIngestions.length > 0 ? (
                  stats.recentIngestions.map((log: any) => (
                    <tr key={log.id} className="text-[#CCCCCC]">
                      <td className="py-3 px-2 font-mono text-white text-[11px]">
                        {log.filename}
                      </td>
                      <td className="py-3 px-2 truncate max-w-[150px]">
                        {log.event?.title || 'Wedding'}
                      </td>
                      <td className="py-3 px-2 text-[11px] text-amber-300">
                        {log.sourceDevice || 'Nikon D750'}
                      </td>
                      <td className="py-3 px-2">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center space-x-1 text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ingested</span>
                          </span>
                        ) : (
                          <span className="text-yellow-400">Duplicate Skipped</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-[#777777] text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#666666]">
                      No frames ingested yet. Start the tether uploader or upload photos to see activity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
