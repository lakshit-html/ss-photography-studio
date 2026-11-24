import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Camera, ShieldCheck, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1918] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 lg:px-12 pt-36 pb-24 w-full space-y-24">
        {/* Story Section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-800">
              The Atelier Story
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[#1A1918] leading-tight">
              Crafting Legacies with Photographic Mastery
            </h1>
            <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
              SS Photography was established with a singular devotion: to preserve weddings with the depth,
              grace, and poise of fine art portraiture.
              We document royal nuptials, palace ceremonies, and intimate celebrations worldwide.
            </p>
            <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
              Every wedding is an unrepeatable gathering of family, rituals, and emotion.
              Our discreet, unobtrusive approach allows couples and guests to immerse themselves fully
              while our cameras document every authentic interaction.
            </p>
            <div className="pt-2">
              <Link
                href="/contact"
                className="inline-flex items-center space-x-2 text-xs uppercase tracking-widest text-amber-800 hover:text-black font-semibold"
              >
                <span>Schedule a Consultation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-[#E6E2D8] bg-[#EAE6DF]">
            <Image
              src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
              alt="SS Photography Studio"
              fill
              className="object-cover"
            />
          </div>
        </section>

        {/* Equipment: Nikon D750 */}
        <section className="p-8 sm:p-14 rounded-3xl bg-white border border-[#E6E2D8] space-y-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] uppercase tracking-widest font-semibold">
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Philosophy</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1918]">
              The Nikon D750 Full-Frame Setup
            </h2>
            <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
              Our principal photographers shoot with the Nikon D750 system for its benchmark dynamic range in challenging lighting conditions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E6E2D8] space-y-2">
              <p className="font-serif text-lg font-bold text-[#1A1918]">24.3 MP Full-Frame Sensor</p>
              <p className="text-xs text-[#777777] leading-relaxed">
                Renders delicate silk textures, bridal jewelry, and natural skin tones with exceptional clarity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E6E2D8] space-y-2">
              <p className="font-serif text-lg font-bold text-[#1A1918]">Low-Light Mandap Sensitivity</p>
              <p className="text-xs text-[#777777] leading-relaxed">
                Resolves subtle shadow nuances during evening phera ceremonies without noise or artificial grain.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E6E2D8] space-y-2">
              <p className="font-serif text-lg font-bold text-[#1A1918]">Tethered Auto-Ingest</p>
              <p className="text-xs text-[#777777] leading-relaxed">
                Streams captures directly from the camera into our AI processing pipeline with zero latency.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
