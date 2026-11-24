import React from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Camera, Sparkles, Check, ArrowRight } from 'lucide-react';

const collections = [
  {
    name: 'Heritage Royale',
    tier: 'Two-Day Wedding Commission',
    tagline: 'Ideal for intimate ceremonies & palace vow exchanges',
    features: [
      '2 Principal Photographers with dual Nikon full-frame cameras',
      'Up to 16 Hours of continuous wedding coverage',
      'Table Easel QR code posters for wedding guest photo access',
      'Instant AI Face Recognition: guests find their photos on the wedding day',
      '600+ Masterfully retouched high-resolution images',
      'Private online gallery with cloud hosting',
      'Full resolution digital negative delivery',
    ],
    popular: false,
  },
  {
    name: 'Palatial Grandeur',
    tier: 'Flagship Three-Day Commission',
    tagline: 'Our most requested comprehensive royal wedding coverage',
    features: [
      '3 Principal Photographers + dedicated Nikon D750 tethered ingestion specialist',
      'Real-time photo streaming from camera to guest discovery gallery',
      'Full 3-Day multi-ceremony coverage (Mehendi, Sangeet, Wedding, Reception)',
      'Custom table easel QR code displays designed for table placement',
      'Instant AI Face Recognition with single & ZIP batch photo downloads',
      'Handcrafted 30-page Italian archival leather heirloom album',
      '1,200+ Master-grade color-graded high-resolution photos',
      'Priority turnaround with cinematic slideshow preview',
    ],
    popular: true,
  },
  {
    name: 'Destination Celestial',
    tier: 'Bespoke Worldwide Commission',
    tagline: 'All-inclusive multi-day celebration coverage worldwide',
    features: [
      'Complete multi-day bespoke wedding entourage & aerial coverage',
      'High-speed Nikon live tethered ingest workstation on location',
      'Dedicated guest QR concierge assisting family with instant AI discovery',
      'Two companion leather albums for parents + main regal heirloom album',
      'Archival drive with complete uncompressed Nikon digital negatives',
      'Lifetime private cloud gallery vault backup',
      'Express turnaround',
    ],
    popular: false,
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1918] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 lg:px-12 pt-36 pb-24 w-full">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-800">
            Bespoke Commissions
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-[#1A1918]">
            Wedding Collections
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
            Every collection pairs master-level Nikon optical precision with our modern
            AI face discovery gallery. Transparent, comprehensive, and tailored for timeless elegance.
          </p>
        </div>

        {/* Pricing & Collections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
          {collections.map((col, idx) => (
            <div
              key={idx}
              className={`relative rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all duration-300 ${
                col.popular
                  ? 'bg-white border-2 border-amber-800 shadow-xl'
                  : 'bg-white border border-[#E6E2D8] hover:border-[#D0CCC4]'
              }`}
            >
              {col.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-800 text-white font-semibold text-[10px] uppercase tracking-widest">
                  Featured Collection
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <span className="text-[11px] uppercase tracking-widest text-amber-800 font-semibold">
                    {col.tier}
                  </span>
                  <h3 className="font-serif text-3xl font-bold text-[#1A1918] mt-1">{col.name}</h3>
                  <p className="text-xs text-[#777777] mt-2 leading-relaxed">{col.tagline}</p>
                </div>

                <div className="h-[1px] bg-[#EAE6DF]" />

                <div className="space-y-3.5">
                  <p className="text-xs font-semibold text-[#1A1918] uppercase tracking-wider">What is included:</p>
                  <ul className="space-y-3 text-xs text-[#555555]">
                    {col.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start space-x-2.5">
                        <Check className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-[#EAE6DF]">
                <Link
                  href="/contact"
                  className={`w-full py-4 rounded-full flex items-center justify-center space-x-2 text-xs uppercase tracking-[0.2em] font-semibold transition-all ${
                    col.popular
                      ? 'bg-[#1A1918] text-white hover:bg-amber-800'
                      : 'bg-[#F2EFE9] text-[#1A1918] hover:bg-[#1A1918] hover:text-white'
                  }`}
                >
                  <span>Inquire for Date</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
