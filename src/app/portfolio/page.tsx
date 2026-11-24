'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { X, Eye } from 'lucide-react';

const portfolioItems = [
  {
    id: 1,
    title: 'Palace Nuptials',
    category: 'Palaces',
    location: 'Rajasthan',
    img: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 2,
    title: 'Sunset Vows by the Sea',
    category: 'Destinations',
    location: 'Goa',
    img: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 3,
    title: 'Sacred Seven Pheras',
    category: 'Rituals',
    location: 'Haveli Courtyard',
    img: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 4,
    title: 'Golden Hour Portraits',
    category: 'Palaces',
    location: 'Jaipur',
    img: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 5,
    title: 'Unscripted Laughter',
    category: 'Candid',
    location: 'New Delhi',
    img: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 6,
    title: 'Sangeet Choreography',
    category: 'Candid',
    location: 'Fairmont',
    img: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?auto=format&fit=crop&w=1600&q=85',
  },
];

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  const tabs = ['All', 'Palaces', 'Destinations', 'Rituals', 'Candid'];

  const filtered =
    activeTab === 'All'
      ? portfolioItems
      : portfolioItems.filter((item) => item.category === activeTab);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1918] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 lg:px-12 pt-36 pb-24 w-full">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-800">
            Visual Anthology
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-[#1A1918]">
            Wedding Portfolio
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
            Preserved on full-frame Nikon optical rigs. A curated collection of royal ceremonies,
            tender glances, and architectural majesty.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-14 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-xs uppercase tracking-widest font-medium transition-all ${
                activeTab === tab
                  ? 'bg-[#1A1918] text-white shadow-sm'
                  : 'bg-white text-[#666666] border border-[#E6E2D8] hover:text-[#1A1918]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedPhoto(item)}
              className="group cursor-pointer space-y-3"
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-[#EAE6DF] border border-[#E0DCD4]">
                <Image
                  src={item.img}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase tracking-widest text-amber-800 font-semibold">
                  {item.location}
                </span>
                <h3 className="font-serif text-lg font-bold text-[#1A1918]">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center space-y-4">
            <div className="relative w-full h-[65vh] rounded-xl overflow-hidden">
              <Image
                src={selectedPhoto.img}
                alt={selectedPhoto.title}
                fill
                className="object-contain"
              />
            </div>
            <div className="text-center space-y-1 text-white">
              <p className="text-xs tracking-widest uppercase text-amber-300">{selectedPhoto.location}</p>
              <h3 className="font-serif text-2xl font-bold">{selectedPhoto.title}</h3>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
