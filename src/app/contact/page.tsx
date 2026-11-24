'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    weddingDate: '',
    venue: '',
    guestCount: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1A1918] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 lg:px-12 pt-36 pb-24 w-full">
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-800">
            Commence The Dialogue
          </span>
          <h1 className="font-serif text-4xl sm:text-6xl font-bold tracking-tight text-[#1A1918]">
            Reserve Your Date
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed">
            We invite you to share your wedding plans. We take on a strictly limited number of commissions
            to maintain our highest standards of craft.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Studio Info Card */}
          <div className="lg:col-span-5 rounded-3xl bg-white border border-[#E6E2D8] p-8 sm:p-10 space-y-8 flex flex-col justify-between shadow-sm">
            <div className="space-y-6">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#1A1918]">SS Photography Studio</h3>
                <p className="text-xs uppercase tracking-widest text-amber-800 font-semibold mt-1">Wedding Atelier</p>
              </div>

              <p className="text-xs text-[#666666] leading-relaxed">
                Whether you are planning a grand palace celebration, an intimate coastal
                vow exchange, or a destination celebration abroad, our team is equipped to travel worldwide.
              </p>

              <div className="space-y-4 pt-4 border-t border-[#EAE6DF] text-xs">
                <div className="flex items-start space-x-3 text-[#555555]">
                  <MapPin className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                  <span>Available throughout India & international destinations</span>
                </div>
                <div className="flex items-center space-x-3 text-[#555555]">
                  <Phone className="w-4 h-4 text-amber-800 shrink-0" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex items-center space-x-3 text-[#555555]">
                  <Mail className="w-4 h-4 text-amber-800 shrink-0" />
                  <span>weddings@ssphotography.com</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7F5F0] border border-[#E6E2D8] text-xs text-[#777777]">
              <span className="font-semibold text-[#1A1918]">Note:</span> We recommend reserving your wedding dates 4–8 months in advance.
            </div>
          </div>

          {/* Consultation Inquiry Form */}
          <div className="lg:col-span-7 rounded-3xl bg-white border border-[#E6E2D8] p-8 sm:p-10 shadow-sm">
            {submitted ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-green-700 mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-[#1A1918]">Inquiry Received</h3>
                <p className="text-xs text-[#666666] max-w-md mx-auto leading-relaxed">
                  Thank you for considering SS Photography. We will review your wedding date and details and reach out within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priya Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. priya@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Wedding Date</label>
                    <input
                      type="date"
                      value={formData.weddingDate}
                      onChange={(e) => setFormData({ ...formData, weddingDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Venue / City</label>
                    <input
                      type="text"
                      placeholder="e.g. Udaipur, Palace Grounds"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Approx. Guests</label>
                    <input
                      type="text"
                      placeholder="e.g. 200 - 300"
                      value={formData.guestCount}
                      onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#555555] font-semibold">Wedding Details</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us about the ceremonies or special plans..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#FAF8F5] border border-[#DDD8CF] text-[#1A1918] text-xs focus:outline-none focus:border-amber-700 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-full bg-[#1A1918] text-white font-semibold text-xs uppercase tracking-[0.2em] hover:bg-amber-800 transition-all flex items-center justify-center space-x-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Consultation Request</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
