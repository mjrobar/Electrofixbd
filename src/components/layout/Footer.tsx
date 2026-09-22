import React from 'react';
import { Phone, MessageCircle, MapPin, Clock, Wrench, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';
import { SERVICES_DATA } from '../../data/servicesData';

interface FooterProps {
  onNavigate: (path: string) => void;
  onOpenBooking: (serviceName?: string, serviceId?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenBooking }) => {
  return (
    <footer className="bg-[#00325E] text-white pt-14 pb-8 border-t border-[#004179]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 pb-12 border-b border-white/10">
          
          {/* Column 1: Company Profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">
                ElectroFix <span className="text-emerald-400">BD</span>
              </span>
            </div>
            
            <p className="text-white/80 text-sm leading-relaxed">
              ঢাকা শহরে নির্ভরযোগ্য হোম অ্যাপ্লায়েন্স রিপেয়ার ও সার্ভিসিং। ১০+ বছরের অভিজ্ঞ টেকনিশিয়ান দ্বারা এসি, ফ্রিজ, ওয়াশিং মেশিন, মাইক্রোওভেন ও চিপ-লেভেল সার্কিট বোর্ড মেরামত।
            </p>

            <div className="pt-2 flex items-center gap-3">
              {/* Facebook */}
              <a 
                href={BUSINESS_CONFIG.facebookUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-[#1877F2] text-white flex items-center justify-center transition-colors"
                aria-label="Facebook Page"
              >
                <span className="font-bold text-sm">f</span>
              </a>

              {/* YouTube */}
              <a 
                href={BUSINESS_CONFIG.youtubeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-[#FF0000] text-white flex items-center justify-center transition-colors"
                aria-label="YouTube Channel"
              >
                <span className="font-bold text-xs">YT</span>
              </a>

              {/* WhatsApp */}
              <a 
                href={getWhatsAppUrl()} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-[#25D366] text-white flex items-center justify-center transition-colors"
                aria-label="WhatsApp Chat"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>

            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 text-xs font-medium border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>১০+ বছরের বাস্তব অভিজ্ঞতা</span>
              </span>
            </div>
          </div>

          {/* Column 2: Our Services */}
          <div>
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <span>আমাদের সার্ভিসসমূহ</span>
            </h3>
            <ul className="space-y-2.5 text-sm">
              {SERVICES_DATA.map((service) => (
                <li key={service.id}>
                  <button
                    onClick={() => {
                      onNavigate(`/services/${service.slug}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-white/80 hover:text-emerald-300 transition-colors flex items-center gap-1.5 text-left cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400 opacity-60" />
                    <span>{service.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Quick Navigation */}
          <div>
            <h3 className="text-base font-bold text-white mb-4">গুরুত্বপূর্ণ লিংক</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => {
                    onNavigate('/');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-white/80 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  হোম পেইজ (Home)
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    onNavigate('/services');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-white/80 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  সকল সার্ভিস (Services)
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    onNavigate('/our-works');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-white/80 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  কাজের পোর্টফোলিও (Our Works)
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    onNavigate('/contact');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-white/80 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  যোগাযোগ (Contact Us)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenBooking()}
                  className="text-emerald-300 font-semibold hover:text-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>অনলাইন সার্ভিস বুকিং</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Service Area */}
          <div>
            <h3 className="text-base font-bold text-white mb-4">যোগাযোগ ও সেবা এলাকা</h3>
            <div className="space-y-3 text-sm text-white/80">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">সার্ভিস লোকেশন:</div>
                  <div>ঢাকা শহর – সরাসরি হোম সার্ভিস</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">জরুরি কল:</div>
                  <a href={getPhoneCallUrl()} className="text-emerald-300 font-bold hover:underline">
                    {BUSINESS_CONFIG.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-white">কর্মঘণ্টা:</div>
                  <div>সকাল ৮:০০ – রাত ১০:০০ (প্রতিদিন)</div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id="footer-book-btn"
                  onClick={() => onOpenBooking()}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  সার্ভিস বুকিং রিকোয়েস্ট পাঠান
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-white/60">
          <div>
            © {new Date().getFullYear()} {BUSINESS_CONFIG.name}. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Professional Home Service in Dhaka</span>
            <span>•</span>
            <span>Chip-Level Electronics Repair</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
