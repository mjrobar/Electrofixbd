import React, { useState, useEffect } from 'react';
import { Star, Quote, CheckCircle2, Calendar, Clock, Image as ImageIcon, Video, Plus, X, Upload, MessageSquare } from 'lucide-react';
import { TESTIMONIALS_DATA } from '../../data/testimonialsData';
import { Testimonial } from '../../types';

export const TestimonialsSection: React.FC = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<Testimonial | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState('');
  const [serviceType, setServiceType] = useState('AC Repair & Servicing');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [attachedMediaUrl, setAttachedMediaUrl] = useState<string | null>(null);
  const [attachedMediaType, setAttachedMediaType] = useState<'image' | 'video'>('image');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load testimonials on mount (Initial data + User saved feedbacks from localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('electrofix_user_feedbacks');
      if (saved) {
        const parsed = JSON.parse(saved);
        setTestimonials([...parsed, ...TESTIMONIALS_DATA]);
      } else {
        setTestimonials(TESTIMONIALS_DATA);
      }
    } catch (e) {
      setTestimonials(TESTIMONIALS_DATA);
    }
  }, []);

  // Handle file attachment (Image or Video)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setAttachedMediaType(isVideo ? 'video' : 'image');

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedMediaUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Feedback Handler
  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !reviewText.trim()) return;

    setIsSubmitting(true);

    const now = new Date();
    // Format date in Bengali
    const dateStr = now.toLocaleDateString('bn-BD', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    // Format time in Bengali
    const timeStr = now.toLocaleTimeString('bn-BD', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const newFeedback: Testimonial = {
      id: `user-feedback-${Date.now()}`,
      customerName: customerName.trim(),
      location: location.trim() || 'ঢাকা',
      serviceType,
      rating,
      review: reviewText.trim(),
      date: dateStr,
      time: timeStr,
      mediaUrl: attachedMediaUrl || undefined,
      mediaType: attachedMediaUrl ? attachedMediaType : undefined,
      createdAt: now.toISOString()
    };

    // Save to state and localStorage
    try {
      const existingSaved = localStorage.getItem('electrofix_user_feedbacks');
      const savedList = existingSaved ? JSON.parse(existingSaved) : [];
      savedList.unshift(newFeedback);
      localStorage.setItem('electrofix_user_feedbacks', JSON.stringify(savedList));
    } catch (err) {
      console.error('Failed to save feedback in localStorage', err);
    }

    setTestimonials((prev) => [newFeedback, ...prev]);

    // Reset Form
    setCustomerName('');
    setLocation('');
    setReviewText('');
    setAttachedMediaUrl(null);
    setRating(5);
    setIsSubmitting(false);
    setIsSubmitModalOpen(false);

    // Show Confirmation
    setSuccessMessage('আপনার ফিডব্যাক সফলভাবে জমা হয়েছে এবং তালিকায় যুক্ত করা হয়েছে!');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  return (
    <section className="py-16 bg-[#F5F7F9] border-y border-[#DCE3E8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header with Traditional Border and Submit Button */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 mb-10 border-b-2 border-[#004179]">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs font-bold text-white bg-[#004179] px-3 py-1 uppercase tracking-wider rounded-none inline-block">
              Customer Feedback & Reviews
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#17202A] tracking-tight">
              কাস্টমারদের অভিজ্ঞতা ও মতামত
            </h2>
            <p className="text-xs sm:text-sm text-[#5F6B76]">
              ঢাকা শহরে আমাদের টেকনিশিয়ানদের সেবা গ্রহণকারী সন্তুষ্ট গ্রাহকদের অভিজ্ঞতা, মতামত এবং কাজ সম্পন্নের ছবি ও ভিডিও।
            </p>
          </div>

          {/* Traditional Sharp Button: Write a Review / Submit Feedback */}
          <div className="shrink-0">
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="w-full sm:w-auto px-5 py-3 bg-[#004179] hover:bg-[#00325E] text-white font-extrabold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 border-2 border-[#004179] cursor-pointer rounded-none shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>রিভিউ বা মতামত লিখুন (ছবি/ভিডিও সহ)</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div className="mb-8 p-4 bg-emerald-50 border-2 border-emerald-600 text-emerald-900 text-sm font-bold flex items-center justify-between rounded-none">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button 
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-800 hover:text-emerald-950 font-black cursor-pointer px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Testimonials Grid (Traditional Rectangular Cards, 0% Rounded Corner) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedFeedback(item)}
              className="bg-white p-5 border-2 border-[#DCE3E8] hover:border-[#004179] transition-all flex flex-col justify-between cursor-pointer rounded-none shadow-xs group"
            >
              <div>
                {/* Top Row: Rating & Date / Time */}
                <div className="flex items-center justify-between gap-2 border-b border-[#DCE3E8] pb-2.5 mb-3">
                  {/* Rating Stars */}
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-500" />
                    ))}
                  </div>

                  {/* Feedback Date & Time Display */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[#5F6B76] font-semibold">
                    <Calendar className="w-3 h-3 text-[#004179]" />
                    <span>{item.date || '২৩ সেপ্টেম্বর ২০২৬'}</span>
                    <span>•</span>
                    <Clock className="w-3 h-3 text-[#004179]" />
                    <span>{item.time || 'বিকাল ৪:১৫'}</span>
                  </div>
                </div>

                {/* Attached Image or Video Preview (If present) */}
                {item.mediaUrl && (
                  <div className="relative h-44 w-full bg-slate-900 border border-[#DCE3E8] overflow-hidden mb-3 rounded-none">
                    {item.mediaType === 'video' ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800">
                        <video 
                          src={item.mediaUrl} 
                          className="w-full h-full object-cover pointer-events-none" 
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 rounded-none">
                            <Video className="w-3.5 h-3.5" />
                            <span>ভিডিও দেখতে ক্লিক করুন</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full h-full">
                        <img
                          src={item.mediaUrl}
                          alt={item.customerName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-[#001f3d]/85 text-white text-[11px] py-1 px-2.5 flex items-center justify-between border-t border-white/20">
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3 text-emerald-400" />
                            <span>কাস্টমারের ছবি</span>
                          </span>
                          <span className="underline font-bold text-emerald-300">বড় স্ক্রিনে দেখতে ক্লিক করুন</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer Review Text */}
                <p className="text-xs sm:text-sm text-[#17202A] leading-relaxed italic line-clamp-3">
                  "{item.review}"
                </p>
              </div>

              {/* Card Footer: Customer Details & Click Indicator */}
              <div className="mt-4 pt-3.5 border-t-2 border-[#DCE3E8] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#17202A] flex items-center gap-1.5">
                    <span>{item.customerName}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-[#004179] font-medium">
                    {item.serviceType} {item.location ? `• ${item.location}` : ''}
                  </div>
                </div>

                <div className="text-[11px] font-bold text-[#004179] group-hover:underline flex items-center gap-1">
                  <span>বিস্তারিত</span>
                  <span>→</span>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. LARGE SCREEN MODAL (When clicking any feedback card) */}
      {/* ========================================================================= */}
      {selectedFeedback && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto"
          onClick={() => setSelectedFeedback(null)}
        >
          <div 
            className="relative w-full max-w-3xl bg-white border-2 border-black rounded-none shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="bg-[#00325E] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                  কাস্টমার ফিডব্যাক ও কাজের বিবরণ
                </h3>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="px-2.5 py-1 bg-white text-[#00325E] hover:bg-slate-200 font-black text-xs transition-colors rounded-none cursor-pointer"
              >
                ✕ বন্ধ করুন
              </button>
            </div>

            {/* Modal Body: Large Screen Media View */}
            <div className="p-0 bg-black flex items-center justify-center min-h-[220px] sm:min-h-[340px] max-h-[500px]">
              {selectedFeedback.mediaUrl ? (
                selectedFeedback.mediaType === 'video' ? (
                  <video
                    src={selectedFeedback.mediaUrl}
                    controls
                    autoPlay
                    className="w-full max-h-[480px] object-contain"
                  />
                ) : (
                  <img
                    src={selectedFeedback.mediaUrl}
                    alt={selectedFeedback.customerName}
                    className="w-full max-h-[480px] object-contain"
                  />
                )
              ) : (
                <div className="py-12 px-6 text-center text-white/80 space-y-2">
                  <Quote className="w-12 h-12 text-[#004179] mx-auto opacity-80" />
                  <p className="text-sm font-semibold">এই ফিডব্যাকে কোনো ছবি বা ভিডিও সংযুক্ত করা হয়নি।</p>
                </div>
              )}
            </div>

            {/* Customer Information & Full Feedback Text (Traditional Layout) */}
            <div className="p-5 sm:p-6 bg-white space-y-4">
              
              {/* Customer Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#DCE3E8] pb-3">
                <div>
                  <h4 className="text-lg font-black text-[#17202A] flex items-center gap-2">
                    <span>{selectedFeedback.customerName}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-none">
                      ভেরিফাইড কাস্টমার
                    </span>
                  </h4>
                  <p className="text-xs sm:text-sm text-[#004179] font-bold">
                    {selectedFeedback.serviceType} {selectedFeedback.location ? `• ${selectedFeedback.location}` : ''}
                  </p>
                </div>

                {/* Rating & Exact Date / Time */}
                <div className="text-left sm:text-right space-y-1">
                  <div className="flex items-center sm:justify-end gap-1 text-amber-500">
                    {[...Array(selectedFeedback.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-500" />
                    ))}
                  </div>
                  <div className="flex items-center sm:justify-end gap-1.5 text-xs text-[#5F6B76] font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-[#004179]" />
                    <span>{selectedFeedback.date || '২৩ সেপ্টেম্বর ২০২৬'}</span>
                    <span>•</span>
                    <Clock className="w-3.5 h-3.5 text-[#004179]" />
                    <span>{selectedFeedback.time || 'বিকাল ৪:১৫'}</span>
                  </div>
                </div>
              </div>

              {/* Full Feedback Content */}
              <div className="bg-[#F5F7F9] p-4 border-l-4 border-[#004179] space-y-1.5">
                <span className="text-xs font-bold text-[#5F6B76] uppercase tracking-wider block">
                  গ্রাহকের পূর্ণাঙ্গ মতামত:
                </span>
                <p className="text-sm sm:text-base text-[#17202A] leading-relaxed italic font-medium">
                  "{selectedFeedback.review}"
                </p>
              </div>

            </div>

            {/* Modal Bottom Footer */}
            <div className="bg-slate-100 px-5 py-3 border-t border-[#DCE3E8] flex justify-end">
              <button
                onClick={() => setSelectedFeedback(null)}
                className="px-5 py-2 bg-[#004179] text-white font-bold text-xs hover:bg-[#00325E] transition-colors rounded-none cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBMIT FEEDBACK MODAL (With Image or Video Attachment) */}
      {/* ========================================================================= */}
      {isSubmitModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto"
          onClick={() => setIsSubmitModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-xl bg-white border-2 border-black rounded-none shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#00325E] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  আপনার ফিডব্যাক বা রিভিউ জমা দিন
                </h3>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-2 py-0.5 bg-white text-[#00325E] hover:bg-slate-200 font-black text-xs rounded-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Container (Traditional 0% Rounded Corner Style) */}
            <form onSubmit={handleSubmitFeedback} className="p-5 sm:p-6 space-y-4">
              
              {/* Name & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">
                    আপনার নাম <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="যেমন: শরিফুল ইসলাম"
                    className="w-full px-3 py-2 bg-white border-2 border-[#DCE3E8] focus:border-[#004179] text-xs sm:text-sm text-[#17202A] rounded-none focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">
                    আপনার এলাকা / ঠিকানা <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="যেমন: মিরপুর-১০, ঢাকা"
                    className="w-full px-3 py-2 bg-white border-2 border-[#DCE3E8] focus:border-[#004179] text-xs sm:text-sm text-[#17202A] rounded-none focus:outline-none"
                  />
                </div>
              </div>

              {/* Service Taken & Rating */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">
                    কোন সার্ভিস নিয়েছেন? <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#DCE3E8] focus:border-[#004179] text-xs sm:text-sm text-[#17202A] rounded-none focus:outline-none"
                  >
                    <option value="AC Repair & Servicing">AC Repair & Servicing</option>
                    <option value="Refrigerator / Fridge Repair">Refrigerator / Fridge Repair</option>
                    <option value="Washing Machine Repair">Washing Machine Repair</option>
                    <option value="Microwave Oven Repair">Microwave Oven Repair</option>
                    <option value="Dishwasher Repair">Dishwasher Repair</option>
                    <option value="Circuit Board / Chip-Level Repair">Circuit Board / Chip-Level Repair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17202A] mb-1">
                    রেটিং নির্বাচন করুন <span className="text-red-600">*</span>
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        type="button"
                        key={starVal}
                        onClick={() => setRating(starVal)}
                        className="cursor-pointer focus:outline-none"
                      >
                        <Star 
                          className={`w-6 h-6 ${
                            starVal <= rating 
                              ? 'fill-amber-400 text-amber-500' 
                              : 'text-slate-300'
                          }`} 
                        />
                      </button>
                    ))}
                    <span className="text-xs font-bold text-[#004179] ml-1">
                      {rating} স্টার
                    </span>
                  </div>
                </div>
              </div>

              {/* Review / Feedback Text */}
              <div>
                <label className="block text-xs font-bold text-[#17202A] mb-1">
                  আপনার অভিজ্ঞতা ও মতামত লিখুন <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="টেকনিশিয়ান কেমন কাজ করেছেন? সমস্যা সমাধান হয়েছে কি না বিস্তারিত লিখুন..."
                  className="w-full px-3 py-2 bg-white border-2 border-[#DCE3E8] focus:border-[#004179] text-xs sm:text-sm text-[#17202A] rounded-none focus:outline-none"
                />
              </div>

              {/* Attach Image or Video */}
              <div className="border-2 border-dashed border-[#DCE3E8] p-4 bg-slate-50 rounded-none">
                <label className="block text-xs font-bold text-[#17202A] mb-1">
                  ছবি বা ভিডিও সংযুক্ত করুন (ঐচ্ছিক):
                </label>
                <p className="text-[11px] text-[#5F6B76] mb-2">
                  মেরামতকৃত এসি, ফ্রিজ বা সার্কিট বোর্ডের ছবি অথবা ছোট ভিডিও আপলোড করতে পারেন।
                </p>

                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-none file:border-2 file:border-[#004179] file:text-xs file:font-bold file:bg-[#004179] file:text-white hover:file:bg-[#00325E] cursor-pointer"
                />

                {/* Media Preview Box */}
                {attachedMediaUrl && (
                  <div className="mt-3 relative border border-[#DCE3E8] bg-black p-1 max-h-48 overflow-hidden flex items-center justify-center">
                    {attachedMediaType === 'video' ? (
                      <video src={attachedMediaUrl} controls className="max-h-44" />
                    ) : (
                      <img src={attachedMediaUrl} alt="Preview" className="max-h-44 object-contain" />
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachedMediaUrl(null)}
                      className="absolute top-2 right-2 px-2 py-0.5 bg-red-600 text-white font-bold text-xs rounded-none"
                    >
                      ✕ রিমুভ করুন
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Submit and Cancel Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t-2 border-[#DCE3E8]">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 rounded-none cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#004179] hover:bg-[#00325E] text-white font-extrabold text-xs sm:text-sm border-2 border-[#004179] rounded-none cursor-pointer transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? 'পোস্ট হচ্ছে...' : 'ফিডব্যাক পোস্ট করুন'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </section>
  );
};
