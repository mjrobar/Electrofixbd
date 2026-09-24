import React from 'react';
import { Phone, MessageCircle, Clock, ShieldCheck, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

interface EmergencyBannerProps {
  onOpenBooking: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ onOpenBooking }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#002647] via-[#00386b] to-[#004179] text-white py-12 px-4 sm:px-6 lg:px-8 border-y-2 border-[#004179]/60 shadow-lg">
      {/* Decorative ambient background blur lights */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-[#004179]/40 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
        
        {/* Left Column: Heading, Badge, Description, Trust Highlights */}
        <div className="text-center lg:text-left space-y-3.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-400/30 backdrop-blur-xs shadow-xs" style={{ borderRadius: '9999px' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" style={{ borderRadius: '9999px' }} />
            <Clock className="w-3.5 h-3.5 text-emerald-300" />
            <span>সকাল ৮:০০ – রাত ১০:০০ • ঢাকা হোম সার্ভিস</span>
          </div>

          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-snug">
            জরুরি এসি, ফ্রিজ বা ওয়াশিং মেশিন মেরামতের প্রয়োজন?
          </h3>

          <p className="text-xs sm:text-sm lg:text-base text-white/85 leading-relaxed">
            ভারি অ্যাপ্লায়েন্স নিয়ে দোকানে যাওয়ার দরকার নেই। আমাদের অভিজ্ঞ টেকনিশিয়ান সরাসরি আপনার বাসায় পৌঁছে যাবেন।
          </p>

          {/* Trust Highlights */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-1 text-xs text-emerald-200/90 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>কোনো হিডেন চার্জ নেই</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>৩০ দিনের রিপেয়ার ওয়ারেন্টি</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>জেনুইন স্পেয়ার পার্টস</span>
            </span>
          </div>
        </div>

        {/* Right Column: Professionally Designed Action Buttons */}
        <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-3.5 shrink-0">
          
          {/* Button 1: Online Booking (Primary) */}
          <button
            id="emergency-book-modal-btn"
            onClick={onOpenBooking}
            className="group relative px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-extrabold text-sm sm:text-base rounded-xl transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer border border-emerald-400/40"
          >
            <Calendar className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            <span>অনলাইন বুকিং করুন</span>
            <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Button 2: Call Now (High Contrast Direct Phone) */}
          <a
            id="emergency-call-btn"
            href={getPhoneCallUrl()}
            className="px-5 py-3.5 bg-white hover:bg-slate-100 text-[#002647] font-extrabold text-sm sm:text-base rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 border border-white"
          >
            <Phone className="w-4 h-4 text-emerald-600 fill-emerald-600" />
            <span>কল করুন: {BUSINESS_CONFIG.phone}</span>
          </a>

          {/* Button 3: WhatsApp Chat */}
          <a
            id="emergency-whatsapp-btn"
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm sm:text-base rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 border border-emerald-400/30"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>WhatsApp চ্যাট</span>
          </a>

        </div>

      </div>
    </section>
  );
};
