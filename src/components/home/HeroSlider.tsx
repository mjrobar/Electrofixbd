import React, { useState, useEffect } from 'react';
import { Calendar, Phone, MessageCircle, ChevronLeft, ChevronRight, ShieldCheck, Wrench, Sparkles } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

interface HeroSliderProps {
  onOpenBooking: (serviceName?: string) => void;
  onNavigate: (path: string) => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ onOpenBooking, onNavigate }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 1,
      badge: '📍 ঢাকা – দ্রুত ও নির্ভরযোগ্য হোম সার্ভিস',
      title: 'Professional Home Appliance Repair at Your Doorstep',
      titleBn: 'আপনার বাসায় এসে দক্ষ টেকনিশিয়ান দ্বারা অ্যাপ্লায়েন্স সার্ভিসিং',
      description: 'Reliable repair and servicing for AC, Refrigerator, Washing Machine, Microwave Oven & Dishwasher across all areas of Dhaka.',
      image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1600&q=80',
      primaryCta: 'Book a Service',
      secondaryCta: 'Call Now',
      isPhoneCall: true,
      serviceHint: 'AC Repair & Servicing'
    },
    {
      id: 2,
      badge: '❄️ ইনভার্টার এসি ও রেফ্রিজারেটর স্পেশালিস্ট',
      title: 'Expert Inverter AC & Refrigerator Servicing',
      titleBn: 'ঠান্ডা না হওয়া, গ্যাস লিকেজ ও সেন্সর সমস্যার নিখুঁত সমাধান',
      description: 'Accurate fault diagnosis, master jet servicing, gas charging, and genuine parts replacement with 10+ years of practical field experience.',
      image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1600&q=80',
      primaryCta: 'Request a Service',
      secondaryCta: 'WhatsApp Us',
      isWhatsApp: true,
      serviceHint: 'Refrigerator / Fridge Repair'
    },
    {
      id: 3,
      badge: '🛠️ সার্কিট বোর্ড রিপেয়ার – চিপ লেভেল কাজ',
      title: '10+ Years Experienced Technician • Chip-Level Repair',
      titleBn: 'মাদারবোর্ড ফেলে না দিয়ে চিপ-লেভেলে রিপেয়ার করে খরচ বাঁচান',
      description: 'Electronic control board troubleshooting, micro-soldering, and inverter module recovery for compatible air conditioners and refrigerators.',
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=80',
      primaryCta: 'Book Chip-Level Repair',
      secondaryCta: 'Explore Services',
      isNavigateServices: true,
      serviceHint: 'Circuit Board / Chip-Level Repair'
    }
  ];

  // Auto slide interval (7 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#00325E] text-white select-none">
      {/* Slides Container */}
      <div 
        className="relative min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex items-center transition-all duration-700 ease-in-out"
      >
        {slides.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Background Image with Gradient Overlay */}
              <div className="absolute inset-0">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover object-center filter brightness-40"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#00325E] via-[#004179]/90 to-transparent"></div>
                <div className="absolute inset-0 bg-black/30"></div>
              </div>

              {/* Slide Content */}
              <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center py-12">
                <div className="max-w-2xl space-y-4 sm:space-y-6">
                  
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-emerald-300 text-xs sm:text-sm font-semibold border border-white/20">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{slide.badge}</span>
                  </div>

                  {/* Main Headings */}
                  <div>
                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                      {slide.title}
                    </h1>
                    <p className="mt-2 text-sm sm:text-base font-medium text-emerald-300">
                      {slide.titleBn}
                    </p>
                  </div>

                  {/* Supporting Description */}
                  <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-xl">
                    {slide.description}
                  </p>

                  {/* Key Highlights */}
                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/80 pt-1">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>১০+ বছরের বাস্তব অভিজ্ঞতা</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      <span>সরাসরি কাস্টমারের বাসায় সার্ভিস</span>
                    </span>
                  </div>

                  {/* Call to Actions */}
                  <div className="pt-2 sm:pt-4 flex flex-wrap items-center gap-3 sm:gap-4">
                    <button
                      id={`hero-slide-${slide.id}-primary-btn`}
                      onClick={() => onOpenBooking(slide.serviceHint)}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm sm:text-base rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2 cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{slide.primaryCta}</span>
                    </button>

                    {slide.isPhoneCall && (
                      <a
                        id="hero-call-now-btn"
                        href={getPhoneCallUrl()}
                        className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-sm sm:text-base rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <span>কল করুন: {BUSINESS_CONFIG.phone}</span>
                      </a>
                    )}

                    {slide.isWhatsApp && (
                      <a
                        id="hero-whatsapp-btn"
                        href={getWhatsAppUrl(slide.serviceHint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-sm sm:text-base rounded-lg transition-colors flex items-center gap-2 shadow-md"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp-এ নক দিন</span>
                      </a>
                    )}

                    {slide.isNavigateServices && (
                      <button
                        id="hero-explore-services-btn"
                        onClick={() => onNavigate('/services')}
                        className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-bold text-sm sm:text-base rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <span>সকল সার্ভিস দেখুন</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slider Arrow Controls */}
      <button
        onClick={handlePrev}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Slider Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`h-2.5 rounded-full transition-all cursor-pointer ${
              idx === currentSlide ? 'w-8 bg-emerald-400' : 'w-2.5 bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
