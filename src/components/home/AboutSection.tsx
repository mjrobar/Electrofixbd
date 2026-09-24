import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Clock, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Wrench, 
  Calendar, 
  Award,
  Settings,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { BUSINESS_CONFIG, getPhoneCallUrl, getWhatsAppUrl } from '../../data/siteConfig';

interface AboutSectionProps {
  onOpenBooking: () => void;
  imageUrl?: string;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenBooking, imageUrl }) => {
  const displayImage = imageUrl || (BUSINESS_CONFIG as any).aboutSectionImage || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80';

  const engineeringPillars = [
    {
      icon: Cpu,
      title: 'চিপ-লেভেল ইলেকট্রনিক্স ল্যাব',
      subtitle: 'মাদারবোর্ড ফেলে না দিয়ে মেরামত',
      description: 'আধুনিক ইনভার্টার এসি ও স্মার্ট রেফ্রিজারেটরের মাদারবোর্ড নষ্ট হলে পুরো সার্কিট পরিবর্তন না করে উন্নত ল্যাবে মাইক্রো-কম্পোনেন্ট লেভেলে মেরামত করে ৭০% পর্যন্ত গ্রাহকের খরচ সাশ্রয় করি।'
    },
    {
      icon: MapPin,
      title: 'সরাসরি অন-সাইট হোম সার্ভিস',
      subtitle: 'ঢাকার প্রতিটি এলাকায় দ্রুত উপস্থিতি',
      description: 'মিরপুর, উত্তরা, গুলশান, বনানী, ধানমন্ডি, মোহাম্মদপুর, বসুন্ধরা সহ ঢাকা শহরের যেকোনো প্রান্তে আপনার বাসা বা অফিসে সরাসরি নির্ধারিত সময়ে টেকনিক্যাল টুলসসহ পৌঁছে যাই।'
    },
    {
      icon: Settings,
      title: 'স্বচ্ছ ডায়াগনসিস ও যৌক্তিক বিল',
      subtitle: 'কোনো অপ্রকাশিত বা লুকানো চার্জ নেই',
      description: 'অ্যাপ্লায়েন্সের মূল সমস্যা ও সম্ভাব্য সমাধান কাজ শুরুর পূর্বেই গ্রাহকের সামনে স্পষ্ট তুলে ধরা হয়। অনুমোদিত যৌক্তিক খরচের বাইরে কোনো অতিরিক্ত চার্জ দাবি করা হয় না।'
    },
    {
      icon: ShieldCheck,
      title: '৩০ দিনের লিখিত সার্ভিস ওয়ারেন্টি',
      subtitle: 'জেনুইন পার্টস ও দায়বদ্ধতা',
      description: 'প্রতিটি সফল মেরামতের পর লিখিত সার্ভিস রসিদ ও ৩০ দিনের কার্যকারিতা ওয়ারেন্টি প্রদান করা হয়। ওয়ারেন্টি চলাকালীন একই ত্রুটি দেখা দিলে সম্পূর্ণ বিনামূল্যে অন-কল সাপোর্ট দেওয়া হয়।'
    }
  ];

  const credentialsStats = [
    { value: '১০+', label: 'বছরের টেকনিক্যাল অভিজ্ঞতা' },
    { value: '১৫,০০০+', label: 'সফল অ্যাপ্লায়েন্স সার্ভিস' },
    { value: '১০০%', label: 'জেনুইন স্পেয়ার পার্টস নিশ্চয়তা' },
    { value: '৩০ দিন', label: 'লিখিত সার্ভিস ওয়ারেন্টি' }
  ];

  return (
    <section 
      id="about-electrofix"
      className="relative bg-white border-y border-[#DCE3E8] overflow-hidden w-full text-[#17202A]"
    >
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          
          {/* =========================================================
              LEFT COLUMN: Edge-attached Technical Image
              Strictly attached to Top, Left, and Lower edges of the section
              ========================================================= */}
          <div className="lg:col-span-5 relative min-h-[420px] sm:min-h-[500px] lg:min-h-full flex flex-col justify-end overflow-hidden group border-b lg:border-b-0 lg:border-r border-[#DCE3E8] bg-[#001D38]">
            <img
              src={displayImage}
              alt="ElectroFix BD Technical Specialist inspecting circuit board"
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            {/* Deep Industrial Gradient for maximum legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#001D38] via-[#00284d]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-black/20"></div>

            {/* Traditional Operational Accreditation Placard (Bottom Left) */}
            <div className="relative z-10 m-4 sm:m-6 p-4 sm:p-5 bg-[#002647]/95 backdrop-blur-md border border-[#004179] text-white shadow-2xl rounded-[0.4rem]">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-[0.4rem] bg-[#004179] border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Award className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>প্রস্তুতি ও প্রফেশনাল সনদ</span>
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-white mt-0.5 tracking-tight">
                    ElectroFix BD ইঞ্জিনিয়ারিং টিম
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    ১০+ বছর ধরে ইনভার্টার এসি, রেফ্রিজারেটর ও মাইক্রো-ইলেকট্রনিক্স মেরামতে ঢাকার অন্যতম নির্ভরযোগ্য কারিগরি সেবা কেন্দ্র।
                  </p>
                </div>
              </div>

              {/* Service Areas Tagline */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                  <span>ঢাকা মহানগরীর সকল এরিয়ায় হোম সার্ভিস</span>
                </span>
                <span className="text-emerald-400 font-semibold">৮:০০ AM - ১০:০০ PM</span>
              </div>
            </div>
          </div>

          {/* =========================================================
              RIGHT COLUMN: Company Narrative, Pillars & Contact Bar
              Authentic traditional Bengali typography, structured hierarchy
              ========================================================= */}
          <div className="lg:col-span-7 py-10 sm:py-14 lg:py-16 px-5 sm:px-8 lg:px-12 xl:px-14 flex flex-col justify-center bg-white">
            <div className="max-w-3xl space-y-7">
              
              {/* Header: Editorial Eyebrow & Bold Heading (No AI Pills) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#004179]">
                  <span className="w-6 h-[2px] bg-[#004179]"></span>
                  <span>পরিচিতি ও প্রযুক্তিগত সক্ষমতা · ABOUT ELECTROFIX BD</span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-black text-[#17202A] tracking-tight leading-snug">
                  হোম অ্যাপ্লায়েন্স মেরামতে পেশাদারিত্ব, সততা ও আধুনিক কারিগরি দক্ষতা
                </h2>

                <p className="text-sm sm:text-base text-[#4A5568] leading-relaxed">
                  ভারী এসি, রেফ্রিজারেটর বা ওয়াশিং মেশিন দোকানে বয়ে নেওয়ার দুর্ভোগ এবং অপ্রয়োজনীয় মাদারবোর্ড পরিবর্তনের অযৌক্তিক ব্যয়—উভয় সমস্যার সুনির্দিষ্ট ও স্থায়ী সমাধানে <strong>ElectroFix BD</strong> ঢাকার ঘরে ঘরে নির্ভরযোগ্য সেবা নিশ্চিত করছে। আমাদের অভিজ্ঞ কারিগরি দল সততা, সঠিক ডায়াগনসিস এবং আধুনিক টুলস ব্যবহারের মাধ্যমে আপনার মূলবান গৃহস্থালি যন্ত্রপাতির আয়ু বৃদ্ধি করতে অঙ্গীকারবদ্ধ।
                </p>
              </div>

              {/* Trust Credentials Ledger (4 Stat Metrics) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y border-[#DCE3E8] bg-[#F8FAFC] p-3 sm:p-4 rounded-[0.4rem]">
                {credentialsStats.map((stat, idx) => (
                  <div key={idx} className="text-center sm:text-left px-2 border-r last:border-r-0 border-[#DCE3E8]/80">
                    <div className="text-xl sm:text-2xl font-black text-[#004179] tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-[11px] sm:text-xs text-[#5F6B76] font-semibold mt-0.5 leading-tight">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* 4 Core Technical Pillars - Traditional Structured Grid */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6B76]">
                  আমাদের কর্মপদ্ধতি ও সেবা নিশ্চয়তা
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {engineeringPillars.map((pillar, idx) => {
                    const Icon = pillar.icon;
                    return (
                      <div 
                        key={idx} 
                        className="p-4 rounded-[0.4rem] bg-[#FFFFFF] border border-[#CBD5E1] hover:border-[#004179] hover:shadow-xs transition-all duration-200 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-[0.4rem] bg-[#EAF3F9] text-[#004179] group-hover:bg-[#004179] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#17202A] leading-snug">
                              {pillar.title}
                            </h4>
                            <p className="text-[11px] font-semibold text-[#004179] mt-0.5">
                              {pillar.subtitle}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-[#5F6B76] leading-relaxed mt-2.5 pt-2 border-t border-[#E2E8F0]">
                          {pillar.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quality & Safety Pledge Note */}
              <div className="flex items-start gap-3 p-3.5 rounded-[0.4rem] bg-[#EAF3F9]/60 border border-[#B9D5EC] text-xs text-[#1E3A5F]">
                <FileCheck className="w-5 h-5 text-[#004179] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-[#004179]">দায়িত্বশীল হোম সার্ভিসের প্রতিশ্রুতি:</span> আমাদের প্রতিটি টেকনিশিয়ান ব্যাকগ্রাউন্ড-যাচাইকৃত এবং গৃহস্থালি পরিবেশের নিরাপত্তা ও শালীনতার প্রতি সর্বোচ্চ শ্রদ্ধাশীল। মেরামতের পূর্বে ও পরে সম্পূর্ণ কাজের রিপোর্ট ও ওয়ারেন্টি ইনভয়েস প্রদান করা হয়।
                </div>
              </div>

              {/* Direct Booking & Hotline Action Bar */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#00325E] text-white p-4 sm:p-5 rounded-[0.4rem] shadow-sm">
                <div>
                  <div className="text-[11px] uppercase font-bold text-emerald-300 tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ borderRadius: '9999px' }} />
                    <span>জরুরি হোম সার্ভিসের হটলাইন</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white mt-0.5 tracking-tight">
                    {BUSINESS_CONFIG.phone}
                  </div>
                  <div className="text-[11px] text-white/70">
                    সকাল ৮:০০ – রাত ১০:০০ • ঢাকা শহরব্যাপী সক্রিয়
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <a
                    href={getPhoneCallUrl()}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 h-10 bg-white hover:bg-slate-100 text-[#00325E] text-xs sm:text-sm font-bold rounded-[0.4rem] transition-colors shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    <Phone className="w-4 h-4 text-emerald-600 fill-emerald-600 shrink-0" />
                    <span>সরাসরি কল</span>
                  </a>

                  <button
                    onClick={onOpenBooking}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 h-10 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-[0.4rem] transition-all shadow-xs cursor-pointer active:scale-98"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>অনলাইন বুকিং</span>
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
