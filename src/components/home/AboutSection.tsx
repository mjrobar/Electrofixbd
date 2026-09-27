import React, { useState, useEffect, useRef } from 'react';
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
  FileCheck,
  Zap,
  Activity
} from 'lucide-react';
import { BUSINESS_CONFIG, getPhoneCallUrl, getWhatsAppUrl } from '../../data/siteConfig';

interface AboutSectionProps {
  onOpenBooking: () => void;
  imageUrl?: string;
}

// Helper to convert English digits to authentic Bengali numerals
const toBengaliNumber = (num: number): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toLocaleString('en-US').replace(/\d/g, (d) => bnDigits[Number(d)]);
};

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenBooking, imageUrl }) => {
  const displayImage = imageUrl || (BUSINESS_CONFIG as any).aboutSectionImage || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80';

  // Stats counting animation trigger on scroll
  const statsRef = useRef<HTMLDivElement>(null);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [counts, setCounts] = useState({
    stat1: 0,
    stat2: 0,
    stat3: 0,
    stat4: 0,
  });

  // Intersection Observer to trigger counter when scrolled into view from hero or reload
  useEffect(() => {
    const currentRef = statsRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasTriggered) {
          setHasTriggered(true);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, [hasTriggered]);

  // Counting animation logic
  useEffect(() => {
    if (!hasTriggered) return;

    const duration = 1600; // 1.6s smooth duration
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic curve for realistic deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setCounts({
        stat1: Math.floor(easeProgress * 10),
        stat2: Math.floor(easeProgress * 15000),
        stat3: Math.floor(easeProgress * 100),
        stat4: Math.floor(easeProgress * 30),
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCounts({
          stat1: 10,
          stat2: 15000,
          stat3: 100,
          stat4: 30,
        });
      }
    };

    requestAnimationFrame(animate);
  }, [hasTriggered]);

  const engineeringPillars = [
    {
      icon: Cpu,
      title: 'চিপ-লেভেল ইলেকট্রনিক্স ল্যাব',
      subtitle: 'মাদারবোর্ড ফেলে না দিয়ে মাইক্রো-রিপেয়ার',
      description: 'আধুনিক ইনভার্টার এসি ও স্মার্ট রেফ্রিজারেটরের মাদারবোর্ড নষ্ট হলে পুরো সার্কিট পরিবর্তন না করে আমাদের উন্নত ল্যাবে মাইক্রো-কম্পোনেন্ট লেভেলে মেরামত করে ৭০% পর্যন্ত গ্রাহকের খরচ সাশ্রয় করি।'
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
              Clean, authentic photography without artificial overlays
              ========================================================= */}
          <div className="lg:col-span-5 relative min-h-[380px] sm:min-h-[460px] lg:min-h-full flex flex-col justify-end overflow-hidden group border-b lg:border-b-0 lg:border-r border-[#DCE3E8] bg-[#001D38]">
            <img
              src={displayImage}
              alt="ElectroFix BD Technical Specialist inspecting circuit board"
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            {/* Subtle natural vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"></div>
          </div>

          {/* =========================================================
              RIGHT COLUMN: Company Narrative, Pillars & Contact Bar
              Authentic traditional Bengali typography, structured hierarchy
              ========================================================= */}
          <div className="lg:col-span-7 py-10 sm:py-14 lg:py-16 px-5 sm:px-8 lg:px-12 xl:px-14 flex flex-col justify-center bg-white">
            <div className="max-w-3xl space-y-7">
              
              {/* Header: Professional Crafted Authority Badge & Bold Heading (Item 4 & Item 1) */}
              <div className="space-y-3.5">
                
                {/* Crafted Engineering Credential Tag - Authentic & Premium (No AI Pills) */}
                <div 
                  className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#002647] text-white border-l-4 border-emerald-500 rounded-[0.4rem] shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold tracking-wide text-white">
                    পরিচিতি ও প্রযুক্তিগত সক্ষমতা
                  </span>
                  <span className="text-white/40 text-xs font-light">|</span>
                  <span className="text-[11px] sm:text-xs font-semibold tracking-wider text-emerald-300 uppercase">
                    ABOUT ELECTROFIX BD
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-black text-[#17202A] tracking-tight leading-snug">
                  হোম অ্যাপ্লায়েন্স মেরামতে পেশাদারিত্ব, সততা ও আধুনিক কারিগরি দক্ষতা
                </h2>

                {/* Sub-text with increased, comfortable, readable font size (Item 1) */}
                <p className="text-base sm:text-lg text-[#334155] leading-relaxed font-normal">
                  ভারী এসি, রেফ্রিজারেটর বা ওয়াশিং মেশিন দোকানে বয়ে নেওয়ার দুর্ভোগ এবং অপ্রয়োজনীয় মাদারবোর্ড পরিবর্তনের অযৌক্তিক ব্যয়—উভয় সমস্যার সুনির্দিষ্ট ও স্থায়ী সমাধানে <strong className="text-[#00325e] font-bold">ElectroFix BD</strong> ঢাকার ঘরে ঘরে নির্ভরযোগ্য সেবা নিশ্চিত করছে। আমাদের অভিজ্ঞ কারিগরি দল সততা, সঠিক ডায়াগনসিস এবং আধুনিক টুলস ব্যবহারের মাধ্যমে আপনার মূলবান গৃহস্থালি যন্ত্রপাতির আয়ু বৃদ্ধি করতে অঙ্গীকারবদ্ধ।
                </p>
              </div>

              {/* =========================================================
                  ITEM 3: Trust Credentials Stats with Background & Counting Animation
                  Scroll-triggered counting animation in authentic Bengali numerals
                  ========================================================= */}
              <div 
                ref={statsRef}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 px-3 sm:px-5 bg-gradient-to-r from-[#002244] via-[#002e5c] to-[#003a70] text-white rounded-[0.4rem] shadow-md border border-[#004d80]"
                style={{ borderRadius: '0.4rem' }}
              >
                {/* Stat 1: 10+ Years */}
                <div className="text-center sm:text-left px-2 sm:px-3 border-r border-white/15">
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-300 tracking-tight font-bengali">
                    <span>{toBengaliNumber(counts.stat1)}</span>
                    <span className="text-emerald-400 font-extrabold">+</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 font-medium mt-1 leading-snug">
                    বছরের টেকনিক্যাল অভিজ্ঞতা
                  </div>
                </div>

                {/* Stat 2: 15,000+ Services */}
                <div className="text-center sm:text-left px-2 sm:px-3 border-r sm:border-r border-white/15">
                  <div className="flex items-center justify-center sm:justify-start gap-1 text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-300 tracking-tight font-bengali">
                    <span>{toBengaliNumber(counts.stat2)}</span>
                    <span className="text-emerald-400 font-extrabold">+</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 font-medium mt-1 leading-snug">
                    সফল অ্যাপ্লায়েন্স সার্ভিস
                  </div>
                </div>

                {/* Stat 3: 100% Genuine Parts */}
                <div className="text-center sm:text-left px-2 sm:px-3 border-r border-white/15">
                  <div className="flex items-center justify-center sm:justify-start gap-0.5 text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-300 tracking-tight font-bengali">
                    <span>{toBengaliNumber(counts.stat3)}</span>
                    <span className="text-emerald-400 font-bold">%</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 font-medium mt-1 leading-snug">
                    জেনুইন স্পেয়ার পার্টস নিশ্চয়তা
                  </div>
                </div>

                {/* Stat 4: 30 Days Warranty */}
                <div className="text-center sm:text-left px-2 sm:px-3">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-2xl sm:text-3xl lg:text-4xl font-black text-emerald-300 tracking-tight font-bengali">
                    <span>{toBengaliNumber(counts.stat4)}</span>
                    <span className="text-base sm:text-xl font-bold text-white">দিন</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 font-medium mt-1 leading-snug">
                    লিখিত সার্ভিস ওয়ারেন্টি
                  </div>
                </div>
              </div>

              {/* =========================================================
                  ITEM 2: 4 Core Technical Pillars with #00325e Background & Hover Shadow
                  ITEM 1: Increased, legible, comfortable typography
                  ========================================================= */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#00325e] rounded-full" style={{ borderRadius: '9999px' }}></span>
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#1e293b]">
                    আমাদের কর্মপদ্ধতি ও সেবা নিশ্চয়তা
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {engineeringPillars.map((pillar, idx) => {
                    const Icon = pillar.icon;
                    return (
                      <div 
                        key={idx} 
                        className="p-5 rounded-[0.4rem] bg-[#00325e] text-white border border-[#004b87] hover:border-emerald-400/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#002647]/50 group cursor-default"
                        style={{ borderRadius: '0.4rem' }}
                      >
                        <div className="flex items-start gap-3.5">
                          <div 
                            className="w-11 h-11 rounded-[0.4rem] bg-white/10 text-emerald-400 border border-white/15 group-hover:bg-emerald-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-xs"
                            style={{ borderRadius: '0.4rem' }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                              {pillar.title}
                            </h4>
                            <p className="text-xs sm:text-sm font-semibold text-emerald-300 mt-0.5">
                              {pillar.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Sub-text / Description with comfortable, legible font size (Item 1 & 2) */}
                        <p className="text-sm sm:text-[15px] text-slate-100 leading-relaxed font-normal mt-3 pt-3 border-t border-white/15">
                          {pillar.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quality & Safety Pledge Note with comfortable font size */}
              <div 
                className="flex items-start gap-3 p-4 rounded-[0.4rem] bg-[#EAF3F9] border border-[#B9D5EC] text-sm sm:text-[15px] text-[#1E3A5F] shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <FileCheck className="w-5 h-5 text-[#004179] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold text-[#004179]">দায়িত্বশীল হোম সার্ভিসের প্রতিশ্রুতি:</span> আমাদের প্রতিটি টেকনিশিয়ান ব্যাকগ্রাউন্ড-যাচাইকৃত এবং গৃহস্থালি পরিবেশের নিরাপত্তা ও শালীনতার প্রতি সর্বোচ্চ শ্রদ্ধাশীল। মেরামতের পূর্বে ও পরে সম্পূর্ণ কাজের রিপোর্ট ও ওয়ারেন্টি ইনভয়েস প্রদান করা হয়।
                </div>
              </div>

              {/* Direct Booking & Hotline Action Bar */}
              <div 
                className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#00325E] text-white p-4 sm:p-5 rounded-[0.4rem] shadow-sm border border-[#004b87]"
                style={{ borderRadius: '0.4rem' }}
              >
                <div>
                  <div className="text-xs uppercase font-bold text-emerald-300 tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" style={{ borderRadius: '9999px' }} />
                    <span>জরুরি হোম সার্ভিসের হটলাইন</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white mt-0.5 tracking-tight font-bengali">
                    {BUSINESS_CONFIG.phone}
                  </div>
                  <div className="text-xs text-white/80">
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
