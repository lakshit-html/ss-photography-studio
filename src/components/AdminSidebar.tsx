'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Image as ImageIcon,
  Camera,
  Stamp,
  QrCode,
  LayoutDashboard,
  ExternalLink,
  HardDrive,
} from 'lucide-react';

export default function AdminSidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Studio Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Wedding Events', href: '/admin/events', icon: Calendar },
    { label: 'Photo Vault', href: '/admin/photos', icon: ImageIcon },
    { label: 'Nikon D750 Ingest', href: '/admin/tether', icon: Camera },
    { label: 'Server & Storage', href: '/admin/storage', icon: HardDrive },
    { label: 'Branding & Watermark', href: '/admin/branding', icon: Stamp },
    { label: 'Printable QR Posters', href: '/admin/posters', icon: QrCode },
  ];

  return (
    <aside className="w-64 bg-[#141414] border-r border-[#262626] flex flex-col justify-between shrink-0 h-screen sticky top-0 text-[#CCCCCC]">
      <div className="p-6 space-y-8">
        {/* Studio Brand Header */}
        <div className="space-y-1">
          <Link href="/admin" className="block">
            <span className="font-serif text-lg font-bold tracking-[0.2em] text-white">
              SS PHOTOGRAPHY
            </span>
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-semibold font-sans mt-0.5">
              Studio Workspace
            </p>
          </Link>
          <div className="w-8 h-[1.5px] bg-amber-500 mt-2" />
        </div>

        {/* Studio Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                    : 'text-[#AAAAAA] hover:text-white hover:bg-[#1E1E1E]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-[#777777]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* External Preview Link */}
      <div className="p-6 border-t border-[#262626]">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between text-xs text-[#888888] hover:text-white transition-colors p-2 rounded-lg hover:bg-[#1E1E1E]"
        >
          <span>Open Public Site</span>
          <ExternalLink className="w-3.5 h-3.5 text-[#666666]" />
        </Link>
      </div>
    </aside>
  );
}
