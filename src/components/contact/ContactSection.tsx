import React, { useState } from 'react';
import { Phone, MessageCircle, MapPin, Clock, Send, CheckCircle2, AlertCircle, Wrench, ShieldCheck } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

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
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          message: message.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message.');
      }

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
    <div className="py-12 sm:py-16 bg-[#F5F7F9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#004179] bg-[#EAF3F9] px-3 py-1 rounded-full uppercase tracking-wider">
            Get In Touch
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#17202A] mt-2 tracking-tight">
            যোগাযোগ ও অনুসন্ধান (Contact Us)
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#5F6B76]">
            আপনার যেকোনো হোম অ্যাপ্লায়েন্স রিপেয়ারের প্রয়োজনে কল করুন, হোয়াটসঅ্যাপে মেসেজ দিন অথবা নিচের ফর্মটি পূরণ করুন।
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Left Column: Direct Info Cards */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white p-6 rounded-2xl border border-[#DCE3E8] shadow-xs space-y-5">
              <h2 className="text-lg font-bold text-[#17202A] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#004179]" />
                <span>ব্যবসায়িক যোগাযোগের তথ্য</span>
              </h2>

              {/* Phone */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#F5F7F9] border border-[#DCE3E8]/60">
                <div className="w-10 h-10 rounded-lg bg-[#004179] text-white flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-[#5F6B76] font-medium">সরাসরি কল করুন (Phone):</div>
                  <a href={getPhoneCallUrl()} className="text-base font-extrabold text-[#004179] hover:underline">
                    {BUSINESS_CONFIG.phone}
                  </a>
                  <div className="text-[11px] text-slate-500">হোম সার্ভিসের জন্য তাৎক্ষণিক সহায়তা</div>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-emerald-800 font-medium">WhatsApp চ্যাট:</div>
                  <a 
                    href={getWhatsAppUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-base font-extrabold text-emerald-700 hover:underline"
                  >
                    {BUSINESS_CONFIG.phone}
                  </a>
                  <div className="text-[11px] text-emerald-600">সমস্যার ছবি বা ভিডিও পাঠাতে পারেন</div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#F5F7F9] border border-[#DCE3E8]/60">
                <div className="w-10 h-10 rounded-lg bg-[#004179] text-white flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-[#5F6B76] font-medium">সার্ভিস এরিয়া (Location):</div>
                  <div className="text-sm font-bold text-[#17202A]">{BUSINESS_CONFIG.serviceCoverage}</div>
                  <div className="text-[11px] text-slate-500">মিরপুর, উত্তরা, গুলশান, ধানমন্ডি, বনানী ও সমগ্র ঢাকা</div>
                </div>
              </div>

              {/* Hours */}
              <div className="flex items-start gap-3.5 p-3 rounded-xl bg-[#F5F7F9] border border-[#DCE3E8]/60">
                <div className="w-10 h-10 rounded-lg bg-[#004179] text-white flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-[#5F6B76] font-medium">কর্মঘণ্টা (Business Hours):</div>
                  <div className="text-sm font-bold text-[#17202A]">{BUSINESS_CONFIG.businessHours}</div>
                </div>
              </div>

            </div>

            {/* Social Proof Box */}
            <div className="bg-[#EAF3F9] p-5 rounded-2xl border border-[#004179]/20 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#004179]">
                <ShieldCheck className="w-4 h-4" />
                <span>আমাদের সোশ্যাল মিডিয়া চ্যানেলসমূহ</span>
              </div>
              <p className="text-xs text-[#5F6B76] leading-relaxed">
                আমাদের টেকনিশিয়ানের কাজের ভিডিও ও কাস্টমারদের রিভিউ দেখতে পারেন অফিসিয়াল চ্যানেলে:
              </p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href={BUSINESS_CONFIG.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#1877F2] text-white text-xs font-bold rounded-lg shadow-xs hover:opacity-90 flex items-center gap-1.5"
                >
                  <span>Facebook পেইজ</span>
                </a>
                <a
                  href={BUSINESS_CONFIG.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg shadow-xs hover:opacity-90 flex items-center gap-1.5"
                >
                  <span>YouTube চ্যানেল</span>
                </a>
              </div>
            </div>

          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#DCE3E8] shadow-xs">
              <h2 className="text-xl font-bold text-[#17202A] mb-1">
                আমাদের একটি বার্তা পাঠান (Send a Message)
              </h2>
              <p className="text-xs sm:text-sm text-[#5F6B76] mb-6">
                আপনার অ্যাপ্লায়েন্সে কী সমস্যা হচ্ছে নিচে লিখুন, আমরা দ্রুত কল করে সহায়তা করব।
              </p>

              {successMsg && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs sm:text-sm text-emerald-800 flex items-start gap-3 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">বার্তা সফলভাবে পাঠানো হয়েছে!</p>
                    <p className="mt-0.5 text-emerald-700">{successMsg}</p>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-800 flex items-start gap-3 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">সমস্যা হয়েছে</p>
                    <p className="mt-0.5 text-red-700">{errorMsg}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-bold text-[#17202A] mb-1.5">
                    আপনার নাম <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    required
                    placeholder="আপনার নাম লিখুন"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#DCE3E8] rounded-lg text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#004179] placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-xs font-bold text-[#17202A] mb-1.5">
                    মোবাইল নম্বর <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="contact-phone"
                    required
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#DCE3E8] rounded-lg text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#004179] placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-bold text-[#17202A] mb-1.5">
                    আপনার সমস্যা বা প্রশ্ন <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    placeholder="অ্যাপ্লায়েন্সের নাম, ব্র্যান্ড এবং কী সমস্যা হচ্ছে বিস্তারিত লিখুন..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-[#DCE3E8] rounded-lg text-sm text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#004179] placeholder:text-slate-400 resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    id="contact-submit-btn"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 bg-[#004179] hover:bg-[#00325E] text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
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
