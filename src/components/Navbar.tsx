'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Menu, X, Camera } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Collections', href: '/services' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E6E2D8] py-4 shadow-sm text-[#1A1918]'
          : 'bg-gradient-to-b from-black/70 via-black/30 to-transparent py-6 text-white'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="group flex flex-col items-start">
          <span className={`font-serif text-xl sm:text-2xl font-bold tracking-[0.25em] transition-colors ${
            scrolled ? 'text-[#1A1918] group-hover:text-amber-700' : 'text-white group-hover:text-amber-300'
          }`}>
            SS PHOTOGRAPHY
          </span>
          <span className={`text-[9px] tracking-[0.35em] uppercase font-semibold font-sans ${
            scrolled ? 'text-amber-800' : 'text-amber-400'
          }`}>
            Wedding Atelier
          </span>
        </Link>

        {/* Client Navigation Links */}
        <nav className="hidden md:flex items-center space-x-10">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-xs uppercase tracking-[0.2em] font-medium transition-colors duration-200 py-1 relative ${
                  scrolled
                    ? isActive
                      ? 'text-[#1A1918] font-bold'
                      : 'text-[#555555] hover:text-[#1A1918]'
                    : isActive
                    ? 'text-white font-bold'
                    : 'text-[#D0D0D0] hover:text-white'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className={`absolute bottom-0 left-0 w-full h-[1.5px] ${scrolled ? 'bg-[#1A1918]' : 'bg-white'}`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Client Contact & Inquire Action */}
        <div className="hidden md:flex items-center space-x-4">
          <Link
            href="/contact"
            className={`text-xs uppercase tracking-widest px-6 py-2.5 rounded-full font-medium transition-all ${
              scrolled
                ? 'bg-[#1A1918] text-white hover:bg-amber-800'
                : 'bg-white text-black hover:bg-amber-100 shadow-lg'
            }`}
          >
            Inquire Availability
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`md:hidden p-2 focus:outline-none ${scrolled ? 'text-[#1A1918]' : 'text-white'}`}
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#FAF8F5] text-[#1A1918] border-b border-[#E6E2D8] px-6 py-8 flex flex-col space-y-6 shadow-xl">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm uppercase tracking-widest text-[#333333] hover:text-amber-800 font-medium"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-[#E6E2D8]">
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 rounded-full bg-[#1A1918] text-white text-xs uppercase tracking-widest flex items-center justify-center font-medium"
            >
              Inquire Availability
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
