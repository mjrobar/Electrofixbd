import React, { useState } from 'react';
import { 
  Phone, 
  MessageCircle, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  ShieldCheck, 
  Tag, 
  Headphones 
} from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';
import { submitContactMessage } from '../../lib/bookingClient';

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার নাম লিখুন।');
      return;
    }
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('অনুগ্রহ করে সঠিক মোবাইল নম্বর দিন।');
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setErrorMsg('অনুগ্রহ করে আপনার অ্যাপ্লায়েন্সের সমস্যার বিবরণ লিখুন।');
      return;
    }

    setIsSubmitting(true);

    try {
      await submitContactMessage({
        name: name.trim(),
        phone: cleanPhone,
        message: message.trim()
      });

      setSuccessMsg('ধন্যবাদ! আপনার বার্তাটি সফলভাবে জমা হয়েছে। আমাদের টেকনিশিয়ান টিম দ্রুত আপনার সাথে যোগাযোগ করবে।');
      setName('');
      setPhone('');
      setMessage('');
    } catch (err: any) {
      console.error('Contact submit error:', err);
      setErrorMsg(err.message || 'We could not send your message right now. Please call us directly at 01619-487788.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-12 pb-16">
      
      {/* ========================================================================= */}
      {/* 1. PROFESSIONAL HERO HEADER (Matching Services Page Design & Background)  */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden w-full bg-[#001f3d] text-white border-b border-[#004179]/60 shadow-md">
        {/* Background Image of technical support & customer service lab */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=80"
            alt="Appliance repair and support at ElectroFix BD"
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
                <span>Page: Contact Us</span>
              </div>

              <div 
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[0.4rem] bg-white/10 border border-white/20 text-white/95 text-xs sm:text-sm font-bold backdrop-blur-xs shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <Headphones className="w-3.5 h-3.5 text-amber-300" />
                <span>Get In Touch</span>
              </div>

              <div 
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[0.4rem] bg-[#00386b]/80 border border-white/15 text-white/90 text-xs sm:text-sm font-semibold"
                style={{ borderRadius: '0.4rem' }}
              >
                <span>📍 সমগ্র ঢাকা সিটি সরাসরি হোম সার্ভিস</span>
              </div>
            </div>

            {/* Main Headline */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                যোগাযোগ ও অনুসন্ধান (Contact Us)
              </h1>
              <p className="mt-2 text-sm sm:text-base lg:text-lg font-bold text-emerald-300">
                সরাসরি হটলাইন • দ্রুত হোয়াটসঅ্যাপ রিপ্লাই • অন-সাইট টেকনিশিয়ান সহায়তা
              </p>
            </div>

            {/* Subtitle / Description - Standard Readable Typography */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-200 leading-relaxed font-normal">
              আপনার যেকোনো হোম অ্যাপ্লায়েন্স রিপেয়ারের প্রয়োজনে কল করুন, হোয়াটসঅ্যাপে মেসেজ দিন অথবা নিচের ফর্মটি পূরণ করে সরাসরি বার্তা পাঠান। আমাদের সাপোর্ট টিম দ্রুত আপনার সাথে যোগাযোগ করবে।
            </p>

            {/* Trust Highlights List */}
            <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/90 font-semibold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>তাৎক্ষণিক কল সহায়তা</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>সকাল ৮:০০ – রাত ১০:০০ সক্রিয়</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <span>কোনো অগ্রিম বুকিং ফি নেই</span>
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTACT CARDS & FORM CONTAINER */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Direct Info Cards */}
          <div className="lg:col-span-5 space-y-6">
            
            <div 
              className="bg-white p-6 sm:p-7 rounded-[0.4rem] border border-[#DCE3E8] shadow-xs space-y-5"
              style={{ borderRadius: '0.4rem' }}
            >
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] flex items-center gap-2.5 pb-2 border-b border-[#DCE3E8]">
                <Wrench className="w-5 h-5 text-[#004179]" />
                <span>ব্যবসায়িক যোগাযোগের তথ্য</span>
              </h2>

              {/* Phone */}
              <div 
                className="flex items-start gap-4 p-4 rounded-[0.4rem] bg-[#F5F7F9] border border-[#DCE3E8]"
                style={{ borderRadius: '0.4rem' }}
              >
                <div 
                  className="w-11 h-11 rounded-[0.4rem] bg-[#004179] text-white flex items-center justify-center shrink-0 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <Phone className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm text-slate-700 font-semibold">সরাসরি কল করুন (Phone):</div>
                  <a href={getPhoneCallUrl()} className="text-lg sm:text-xl font-black text-[#004179] hover:underline block font-mono">
                    {BUSINESS_CONFIG.phone}
                  </a>
                  <div className="text-xs sm:text-sm text-slate-600 font-medium">হোম সার্ভিসের জন্য তাৎক্ষণিক সহায়তা</div>
                </div>
              </div>

              {/* WhatsApp */}
              <div 
                className="flex items-start gap-4 p-4 rounded-[0.4rem] bg-emerald-50/80 border border-emerald-300"
                style={{ borderRadius: '0.4rem' }}
              >
                <div 
                  className="w-11 h-11 rounded-[0.4rem] bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm text-emerald-900 font-semibold">WhatsApp চ্যাট:</div>
                  <a 
                    href={getWhatsAppUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-lg sm:text-xl font-black text-emerald-700 hover:underline block font-mono"
                  >
                    {BUSINESS_CONFIG.phone}
                  </a>
                  <div className="text-xs sm:text-sm text-emerald-700 font-medium">সমস্যার ছবি বা ভিডিও পাঠাতে পারেন</div>
                </div>
              </div>

              {/* Location */}
              <div 
                className="flex items-start gap-4 p-4 rounded-[0.4rem] bg-[#F5F7F9] border border-[#DCE3E8]"
                style={{ borderRadius: '0.4rem' }}
              >
                <div 
                  className="w-11 h-11 rounded-[0.4rem] bg-[#004179] text-white flex items-center justify-center shrink-0 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm text-slate-700 font-semibold">সার্ভিস এরিয়া (Location):</div>
                  <div className="text-sm sm:text-base font-bold text-[#17202A]">{BUSINESS_CONFIG.serviceCoverage}</div>
                  <div className="text-xs sm:text-sm text-slate-600 font-medium">মিরপুর, উত্তরা, গুলশান, ধানমন্ডি, বনানী ও সমগ্র ঢাকা</div>
                </div>
              </div>

              {/* Hours */}
              <div 
                className="flex items-start gap-4 p-4 rounded-[0.4rem] bg-[#F5F7F9] border border-[#DCE3E8]"
                style={{ borderRadius: '0.4rem' }}
              >
                <div 
                  className="w-11 h-11 rounded-[0.4rem] bg-[#004179] text-white flex items-center justify-center shrink-0 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm text-slate-700 font-semibold">কর্মঘণ্টা (Business Hours):</div>
                  <div className="text-sm sm:text-base font-bold text-[#17202A]">{BUSINESS_CONFIG.businessHours}</div>
                </div>
              </div>

            </div>

            {/* Social Media Channels Box - Standard Typography as Marked by User */}
            <div 
              className="bg-[#EAF3F9] p-5 sm:p-6 rounded-[0.4rem] border border-[#004179]/20 space-y-3.5 shadow-xs"
              style={{ borderRadius: '0.4rem' }}
            >
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#004179]">
                <ShieldCheck className="w-5 h-5 text-[#004179]" />
                <span>আমাদের সোশ্যাল মিডিয়া চ্যানেলসমূহ</span>
              </div>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                আমাদের টেকনিশিয়ানের কাজের ভিডিও ও কাস্টমারদের রিভিউ দেখতে পারেন অফিসিয়াল চ্যানেলে:
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={BUSINESS_CONFIG.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm sm:text-base font-bold rounded-[0.4rem] shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <span>Facebook পেইজ</span>
                </a>
                <a
                  href={BUSINESS_CONFIG.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#FF0000] hover:bg-[#e60000] text-white text-sm sm:text-base font-bold rounded-[0.4rem] shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <span>YouTube চ্যানেল</span>
                </a>
              </div>
            </div>

          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <div 
              className="bg-white p-6 sm:p-8 rounded-[0.4rem] border border-[#DCE3E8] shadow-xs"
              style={{ borderRadius: '0.4rem' }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-[#17202A] mb-1.5 tracking-tight">
                আমাদের একটি বার্তা পাঠান (Send a Message)
              </h2>
              {/* Form Subtitle - Standard Legible Font Size */}
              <p className="text-sm sm:text-base text-slate-600 mb-6 font-medium leading-relaxed">
                আপনার অ্যাপ্লায়েন্সে কী সমস্যা হচ্ছে নিচে লিখুন, আমরা দ্রুত কল করে সহায়তা করব।
              </p>

              {successMsg && (
                <div 
                  className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded-[0.4rem] text-sm sm:text-base text-emerald-900 flex items-start gap-3 animate-in fade-in"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">বার্তা সফলভাবে পাঠানো হয়েছে!</p>
                    <p className="mt-0.5 text-emerald-700">{successMsg}</p>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div 
                  className="mb-6 p-4 bg-red-50 border border-red-300 rounded-[0.4rem] text-sm sm:text-base text-red-900 flex items-start gap-3 animate-in fade-in"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">সমস্যা হয়েছে</p>
                    <p className="mt-0.5 text-red-700">{errorMsg}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="contact-name" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                    আপনার নাম <span className="text-red-600 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    required
                    placeholder="আপনার নাম লিখুন"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] placeholder:text-slate-400 shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                    মোবাইল নম্বর <span className="text-red-600 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="tel"
                    id="contact-phone"
                    required
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium font-mono focus:outline-none focus:ring-2 focus:ring-[#004179] placeholder:text-slate-400 shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                    আপনার সমস্যা বা প্রশ্ন <span className="text-red-600 font-bold ml-0.5">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    placeholder="অ্যাপ্লায়েন্সের নাম, ব্র্যান্ড এবং কী সমস্যা হচ্ছে বিস্তারিত লিখুন..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] placeholder:text-slate-400 resize-none shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    id="contact-submit-btn"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 h-11 sm:h-12 bg-[#004179] hover:bg-[#00325E] text-white font-bold text-sm sm:text-base rounded-[0.4rem] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
