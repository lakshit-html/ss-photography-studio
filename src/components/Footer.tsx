import React from 'react';
import Link from 'next/link';
import { Camera, Instagram, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#121110] text-[#999999] border-t border-[#222120] pt-20 pb-12 mt-auto">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        {/* Brand Column */}
        <div className="space-y-4 md:col-span-1">
          <Link href="/" className="inline-block">
            <span className="font-serif text-2xl font-bold tracking-[0.2em] text-white">
              SS PHOTOGRAPHY
            </span>
            <p className="text-[10px] tracking-[0.3em] text-amber-400 uppercase font-sans mt-0.5">
              Wedding Atelier
            </p>
          </Link>
          <p className="text-xs text-[#777777] leading-relaxed pt-2">
            Documenting the romance and sacred grandeur of weddings worldwide.
            Equipped with professional Nikon full-frame cameras and instant AI photo discovery for wedding guests.
          </p>
          <div className="flex items-center space-x-3 pt-2 text-[#999999]">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-amber-400 transition-colors p-2 bg-[#1A1918] rounded-full">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="mailto:solankiluck339@gmail.com" className="hover:text-amber-400 transition-colors p-2 bg-[#1A1918] rounded-full">
              <Mail className="w-4 h-4" />
            </a>
            <a href="tel:+919214404404" className="hover:text-amber-400 transition-colors p-2 bg-[#1A1918] rounded-full">
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-serif text-sm text-white uppercase tracking-[0.2em] font-semibold mb-6">
            Portfolio
          </h4>
          <ul className="space-y-3 text-xs tracking-wider">
            <li>
              <Link href="/portfolio" className="hover:text-white transition-colors">
                Royal Palaces
              </Link>
            </li>
            <li>
              <Link href="/portfolio" className="hover:text-white transition-colors">
                Destination Nuptials
              </Link>
            </li>
            <li>
              <Link href="/portfolio" className="hover:text-white transition-colors">
                Candid Moments
              </Link>
            </li>
            <li>
              <Link href="/services" className="hover:text-white transition-colors">
                Bespoke Collections
              </Link>
            </li>
          </ul>
        </div>

        {/* Studio Philosophy */}
        <div>
          <h4 className="font-serif text-sm text-white uppercase tracking-[0.2em] font-semibold mb-6">
            Craft & Equipment
          </h4>
          <ul className="space-y-3 text-xs tracking-wider text-[#888888]">
            <li className="flex items-center space-x-2 text-amber-300 font-medium">
              <Camera className="w-3.5 h-3.5" />
              <span>Nikon D750 Optical Mastery</span>
            </li>
            <li>
              <span>Smart QR Guest Photo Finder</span>
            </li>
            <li>
              <span>Instant AI Face Matching</span>
            </li>
            <li>
              <span>Archival Fine Art Leather Albums</span>
            </li>
          </ul>
        </div>

        {/* Studio Location */}
        <div>
          <h4 className="font-serif text-sm text-white uppercase tracking-[0.2em] font-semibold mb-6">
            Contact
          </h4>
          <div className="space-y-3 text-xs leading-relaxed">
            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Available for weddings throughout India & international destinations</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>+91 92144 04404 (Suresh Solanki)</span>
            </div>
            <div className="flex items-center space-x-2.5">
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>solankiluck339@gmail.com</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar — Fully decoupled with zero studio admin link */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 border-t border-[#1C1B1A] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#555555]">
        <p>© {new Date().getFullYear()} SS Photography Atelier. All Rights Reserved.</p>
        <p className="mt-4 sm:mt-0 text-[#666666]">Nikon D750 Ingestion & AI Face Match System</p>
      </div>
    </footer>
  );
}
