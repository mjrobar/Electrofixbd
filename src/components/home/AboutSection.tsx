import React from 'react';
import { ShieldCheck, Cpu, Clock, Phone, MapPin, CheckCircle, Wrench, Sparkles } from 'lucide-react';
import { BUSINESS_CONFIG, getPhoneCallUrl } from '../../data/siteConfig';

interface AboutSectionProps {
  onOpenBooking: () => void;
  imageUrl?: string;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenBooking, imageUrl }) => {
  const displayImage = imageUrl || (BUSINESS_CONFIG as any).aboutSectionImage || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80';

  const features = [
    {
      icon: MapPin,
      title: '📍 ঢাকা – সরাসরি হোম সার্ভিস',
      description: 'মিরপুর, উত্তরা, ধানমন্ডি, গুলশান, বনানী, বসুন্ধরা সহ ঢাকার যেকোনো প্রান্তে আপনার বাসায় সরাসরি উপস্থিত হয়ে সার্ভিস প্রদান।'
    },
    {
      icon: ShieldCheck,
      title: '👨‍🔧 ১০+ বছরের অভিজ্ঞ টেকনিশিয়ান',
      description: 'দীর্ঘ এক দশকের বাস্তব কাজের অভিজ্ঞতা সম্পন্ন অভিজ্ঞ টেকনিশিয়ানের তত্ত্বাবধানে নিখুঁত ও নির্ভরযোগ্য অ্যাপ্লায়েন্স সার্ভিস।'
    },
    {
      icon: Cpu,
      title: '🛠 সার্কিট বোর্ড রিপেয়ার – চিপ লেভেল কাজ',
      description: 'ইনভার্টার এসি ও ফ্রিজের মাদারবোর্ড ফেলে না দিয়ে মাইক্রো-সোল্ডারিং ও চিপ-লেভেল পার্টস পরিবর্তনের মাধ্যমে সাশ্রয়ী মেরামত।'
    },
    {
      icon: Clock,
      title: '⚡ দ্রুত, নিরাপদ ও ঝামেলামুক্ত সার্ভিস',
      description: 'যথাযথ প্রফেশনাল টেস্ট টুলস ও উন্নত যন্ত্রপাতির সাহায্যে দ্রুততম সময়ে ফল্ট ডায়াগনসিস এবং নিরাপত্তা নিশ্চিত করে সমাধান।'
    }
  ];

  return (
    <section className="relative bg-white border-y border-[#DCE3E8] overflow-hidden w-full">
      <div className="w-full">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          
          {/* Left Column: Real Tech Photo attached to Top, Left, and Lower Edges */}
          <div className="lg:col-span-5 relative min-h-[380px] sm:min-h-[460px] lg:min-h-full flex flex-col justify-end overflow-hidden group border-b lg:border-b-0 lg:border-r border-[#DCE3E8]">
            <img
              src={displayImage}
              alt="Appliance technician working on circuit board"
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#002647]/95 via-[#002647]/30 to-transparent"></div>
            
            {/* Floating Badge */}
            <div className="relative z-10 m-5 sm:m-6 bg-white/95 backdrop-blur-xs p-4 rounded-xl shadow-lg border border-white max-w-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-[#004179] text-white flex items-center justify-center font-extrabold text-lg shadow-xs shrink-0">
                  10+
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#17202A]">বছরের টেকনিক্যাল অভিজ্ঞতা</h4>
                  <p className="text-xs text-[#5F6B76]">AC, Fridge, Washing Machine & Chip-Level Repair</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Company Story & Direct Facts */}
          <div className="lg:col-span-7 py-12 sm:py-16 px-6 sm:px-10 lg:px-12 xl:px-16 flex flex-col justify-center">
            <div className="max-w-2xl space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF3F9] text-[#004179] text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#004179]" />
                <span>About ElectroFix BD</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A] tracking-tight">
                হোম অ্যাপ্লায়েন্স রিপেয়ারে ঢাকার বিশ্বস্ত সমাধান
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#5F6B76] leading-relaxed">
                ElectroFix BD হলো আপনার ঘরের নিত্যপ্রয়োজনীয় ইলেকট্রনিক ও হোম অ্যাপ্লায়েন্স মেরামতের একটি পেশাদার সার্ভিস প্ল্যাটফর্ম। ভারি এসি বা রেফ্রিজারেটর দোকানে বয়ে নেওয়ার ঝামেলা ছাড়াই, আমরা আপনার ঘরে পৌঁছে দক্ষ ও সৎ টেকনিশিয়ান সেবা প্রদান করে থাকি।
              </p>
            </div>

            {/* Feature List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div key={idx} className="p-4 rounded-xl bg-[#F5F7F9] border border-[#DCE3E8]/70 hover:border-[#004179]/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-[#004179]/10 text-[#004179] flex items-center justify-center mb-2.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#17202A] mb-1">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-[#5F6B76] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Direct Contact Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 bg-[#EAF3F9] p-4 rounded-xl border border-[#004179]/20">
              <div className="flex-1 text-center sm:text-left">
                <div className="text-xs font-semibold text-[#004179] uppercase tracking-wider">
                  📞 কল করে সরাসরি বুকিং নিন
                </div>
                <div className="text-lg font-extrabold text-[#004179]">
                  {BUSINESS_CONFIG.phone}
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <a
                  href={getPhoneCallUrl()}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-[#004179] hover:bg-[#00325E] text-white text-xs font-bold rounded-lg transition-colors text-center"
                >
                  সরাসরি কল
                </a>
                <button
                  onClick={onOpenBooking}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  অনলাইন বুকিং
                </button>
              </div>
            </div>

          </div>

        </div>

        </div>

      </div>
    </section>
  );
};
