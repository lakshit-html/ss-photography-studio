'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, ArrowRight, ShieldCheck, Camera } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@ssphotography.com');
  const [password, setPassword] = useState('Admin@123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center p-6 relative">
      <div className="absolute top-8 left-8">
        <Link href="/" className="font-serif text-lg font-bold tracking-[0.2em] text-white hover:text-brand-400">
          SS PHOTOGRAPHY
        </Link>
      </div>

      <div className="w-full max-w-md rounded-3xl bg-[#111111] border border-[#222222] p-8 sm:p-10 shadow-2xl space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">Photographer Studio Portal</h1>
          <p className="text-xs text-[#888888]">
            Sign in to manage wedding events, Nikon D750 camera ingestion, and guest face galleries.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-wider text-[#AAAAAA] font-medium">Studio Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#666666] absolute left-4 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#161616] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-wider text-[#AAAAAA] font-medium">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#666666] absolute left-4 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#161616] border border-[#2A2A2A] text-white text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full bg-brand-500 text-white font-semibold text-xs uppercase tracking-[0.2em] hover:bg-brand-400 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/20"
          >
            <span>{loading ? 'Authenticating...' : 'Enter Studio Dashboard'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-[11px] text-[#666666] border-t border-[#1C1C1C] flex items-center justify-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
          <span>Protected Studio Access • Session Encrypted</span>
        </div>
      </div>
    </div>
  );
}
