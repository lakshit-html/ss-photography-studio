'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Open access - redirect straight to admin dashboard
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center p-6 text-center">
      <div className="w-full max-w-md rounded-3xl bg-[#111111] border border-[#222222] p-8 sm:p-10 shadow-2xl space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-white">Studio Workspace Open</h1>
        <p className="text-xs text-[#888888]">
          Open access enabled. Redirecting directly to the Studio Admin Dashboard...
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-amber-500 text-black font-semibold text-xs uppercase tracking-wider hover:bg-amber-400 transition-all"
        >
          <span>Enter Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
