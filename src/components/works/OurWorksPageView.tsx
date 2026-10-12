import React from 'react';
import { Tag, Camera, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { WorkGallery } from './WorkGallery';
import { EmergencyBanner } from '../home/EmergencyBanner';

interface OurWorksPageViewProps {
  onOpenBooking: (serviceName?: string) => void;
}

export const OurWorksPageView: React.FC<OurWorksPageViewProps> = ({ onOpenBooking }) => {
  return (
    <div className="w-full space-y-10 pb-12">
      
      {/* ========================================================================= */}
      {/* 1. PROFESSIONAL HERO HEADER (Matching Services Page Design & Background)  */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden w-full bg-[#001f3d] text-white border-b border-[#004179]/60 shadow-md">
        {/* Background Image of real technical repair work */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=80"
            alt="ElectroFix BD Technical Specialists at work"
            className="w-full h-full object-cover object-center filter brightness-35"
            loading="eager"
          />
          {/* Deep Navy Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001b33] via-[#002f54]/95 to-[#004179]/85 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        {/* Header Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-3xl space-y-4">
            
            {/* Top Badges / Indicators */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div 
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[0.4rem] bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs sm:text-sm font-extrabold uppercase tracking-wider backdrop-blur-xs shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <Tag className="w-3.5 h-3.5 text-emerald-300" />
                <span>আমাদের কাজসমূহ</span>
              </div>

              <div 
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[0.4rem] bg-white/10 border border-white/20 text-white/95 text-xs sm:text-sm font-bold backdrop-blur-xs shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                <span>বাস্তব কাজের পোর্টফোলিও</span>
              </div>
            </div>

            {/* Main Headline */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                আমাদের পূর্ববর্তী কাজের বাস্তব গ্যালারি
              </h1>
              <p className="mt-2 text-sm sm:text-base lg:text-lg font-bold text-emerald-300">
                ১০+ বছরের টেকনিক্যাল অভিজ্ঞতা • চিপ-লেভেল মেরামত • সফল বাস্তব কাজ
              </p>
            </div>

            {/* Subtitle / Description - Standard Readable Typography */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-200 leading-relaxed font-normal">
              ঢাকার বিভিন্ন এলাকায় আমাদের দক্ষ টেকনিশিয়ানদের সম্পন্নকৃত বাস্তব কাজের নমুনা ও সমাধান বিবরণ। প্রতিটি কাজের সাথে নিশ্চিত করা হয়েছে জেনুইন পার্টস ও ৩০ দিনের লিখিত সার্ভিস ওয়ারেন্টি।
            </p>

            {/* Trust Highlights List */}
            <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/90 font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>১০০% সমস্যার সমাধান নিশ্চয়তা</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <span>অন-সাইট ডায়াগনসিস ও পার্টস পরিবর্তন</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>৩০ দিনের সার্ভিস নিশ্চয়তা</span>
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. GALLERY CONTAINER */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <WorkGallery onOpenBooking={onOpenBooking} />
        <EmergencyBanner onOpenBooking={() => onOpenBooking()} />
      </div>

    </div>
  );
};
