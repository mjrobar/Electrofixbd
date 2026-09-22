import React from 'react';
import { Phone, MessageCircle, Clock, ShieldCheck, Calendar } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

interface EmergencyBannerProps {
  onOpenBooking: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ onOpenBooking }) => {
  return (
    <section className="bg-gradient-to-r from-[#00325E] to-[#004179] text-white py-10 px-4 sm:px-6 lg:px-8 border-y border-[#004179]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
        
        <div className="text-center lg:text-left space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>সকাল ৮:০০ – রাত ১০:০০ • ঢাকা হোম সার্ভিস</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            জরুরি এসি, ফ্রিজ বা ওয়াশিং মেশিন মেরামতের প্রয়োজন?
          </h3>
          <p className="text-xs sm:text-sm text-white/80 max-w-xl">
            ভারি অ্যাপ্লায়েন্স নিয়ে দোকানে যাওয়ার দরকার নেই। আমাদের অভিজ্ঞ টেকনিশিয়ান সরাসরি আপনার বাসায় পৌঁছে যাবেন।
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            id="emergency-call-btn"
            href={getPhoneCallUrl()}
            className="px-5 py-3 bg-white text-[#004179] hover:bg-slate-100 font-extrabold text-sm rounded-lg transition-all shadow-md flex items-center gap-2"
          >
            <Phone className="w-4 h-4 text-[#004179]" />
            <span>কল করুন: {BUSINESS_CONFIG.phone}</span>
          </a>

          <a
            id="emergency-whatsapp-btn"
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2 shadow-md"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp চ্যাট</span>
          </a>

          <button
            id="emergency-book-modal-btn"
            onClick={onOpenBooking}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2 shadow-md cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>অনলাইন বুকিং</span>
          </button>
        </div>

      </div>
    </section>
  );
};
