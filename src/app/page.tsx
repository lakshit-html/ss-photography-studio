import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Camera, Sparkles, ArrowRight, Check, Heart, QrCode } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1918] flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
        {/* Cinematic Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2000&q=85"
            alt="SS Photography Wedding Atelier"
            fill
            priority
            className="object-cover object-center scale-100 transition-transform duration-1000"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8 pt-24 pb-16 text-white">
          <span className="inline-block text-xs uppercase tracking-[0.3em] font-semibold text-amber-300 font-sans">
            Fine Art Wedding Atelier
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.12]">
            Timeless Elegance, <br />
            <span className="italic font-normal text-amber-200">Unscripted Emotion.</span>
          </h1>

          <p className="max-w-xl mx-auto text-sm sm:text-base text-[#D5D2CD] leading-relaxed font-light tracking-wide">
            SS Photography documents celebrations of love across the world with cinematic distinction.
            Captured on full-frame Nikon optical rigs with instant guest photo discovery.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/portfolio"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-black font-semibold text-xs uppercase tracking-[0.2em] hover:bg-amber-100 transition-all shadow-xl"
            >
              View Selected Stories
            </Link>

            <Link
              href="/contact"
              className="w-full sm:w-auto px-8 py-4 rounded-full border border-white/40 bg-black/30 backdrop-blur-md text-white font-semibold text-xs uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all"
            >
              Inquire Availability
            </Link>
          </div>
        </div>
      </section>

      {/* Guest Discovery Callout */}
      <section className="bg-[#181716] text-white py-12 border-b border-[#2A2928]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mx-auto sm:mx-0">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Attending a Wedding?</p>
              <h3 className="font-serif text-lg font-bold text-white mt-0.5">Find Your Photographs Instantly</h3>
              <p className="text-xs text-[#888888]">
                Scan the QR code displayed on your table easel to find your photos using a quick selfie.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-[#888888]">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Smart In-Memory AI Face Search</span>
          </div>
        </div>
      </section>

      {/* Selected Portfolio Showcase */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12 w-full space-y-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E6E2D8] pb-8">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-800">
              Curated Heirlooms
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-bold text-[#1A1918] tracking-tight mt-2">
              Recent Wedding Stories
            </h2>
          </div>
          <Link
            href="/portfolio"
            className="inline-flex items-center space-x-2 text-xs uppercase tracking-widest font-bold text-[#1A1918] hover:text-amber-800 transition-colors"
          >
            <span>Explore Complete Portfolio</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: 'Palace Celebration',
              location: 'Rajasthan',
              img: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'Coastal Vows at Dusk',
              location: 'Goa',
              img: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
            },
            {
              title: 'Sacred Rituals & Sindoor',
              location: 'Heritage Haveli',
              img: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1200&q=80',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="group cursor-pointer space-y-4"
            >
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#EAE6DF] border border-[#E0DCD4]">
                <Image
                  src={item.img}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-amber-800 font-semibold">{item.location}</span>
                <h3 className="font-serif text-xl font-bold text-[#1A1918]">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Craft & Philosophy */}
      <section className="py-24 bg-[#F2EFE9] border-y border-[#E6E2D8]">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-800">
            Our Philosophy
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1918] max-w-2xl mx-auto leading-snug">
            "We believe the most poignant photographs are not posed, but felt."
          </h2>
          <p className="text-xs sm:text-sm text-[#666666] max-w-xl mx-auto leading-relaxed">
            From quiet glances exchanged before the ceremony to the kinetic joy of the reception dance floor,
            our discreet dual-photographer coverage allows family and friends to be fully present.
          </p>

          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
              <Camera className="w-5 h-5 text-amber-800" />
              <h4 className="font-serif font-bold text-sm text-[#1A1918]">Nikon Full-Frame Precision</h4>
              <p className="text-xs text-[#777777] leading-relaxed">
                Exceptional dynamic range in low-light mandaps and candlelit receptions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
              <Sparkles className="w-5 h-5 text-amber-800" />
              <h4 className="font-serif font-bold text-sm text-[#1A1918]">AI Guest Photo Discovery</h4>
              <p className="text-xs text-[#777777] leading-relaxed">
                Guests find their captures on the same day without waiting months for album distribution.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#E6E2D8] space-y-2">
              <Check className="w-5 h-5 text-amber-800" />
              <h4 className="font-serif font-bold text-sm text-[#1A1918]">Lossless Heirlooms</h4>
              <p className="text-xs text-[#777777] leading-relaxed">
                Full-resolution uncompressed digital negatives delivered to the bride and groom.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Direct Contact Callout */}
      <section className="py-24 max-w-3xl mx-auto px-6 text-center space-y-6">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1918]">
          Let Us Tell Your Story
        </h2>
        <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
          We accept a strictly limited number of wedding commissions annually to ensure our uncompromising dedication to each couple.
        </p>
        <div className="pt-2">
          <Link
            href="/contact"
            className="inline-flex items-center space-x-2 px-8 py-4 rounded-full bg-[#1A1918] text-white font-semibold text-xs uppercase tracking-[0.2em] hover:bg-amber-800 transition-all shadow-lg"
          >
            <span>Inquire for Your Date</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
