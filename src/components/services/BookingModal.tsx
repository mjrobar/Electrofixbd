import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, Copy, Check, AlertCircle, Phone, MessageCircle, Wrench } from 'lucide-react';
import { SERVICES_DATA } from '../../data/servicesData';
import { BUSINESS_CONFIG, getPhoneCallUrl } from '../../data/siteConfig';
import { submitBookingRequest } from '../../lib/bookingClient';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultServiceName?: string;
  defaultServiceId?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  defaultServiceName,
  defaultServiceId,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [serviceId, setServiceId] = useState(defaultServiceId || SERVICES_DATA[0].id);
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Sync default service when modal opens with a specific service
  useEffect(() => {
    if (defaultServiceId) {
      setServiceId(defaultServiceId);
    } else if (defaultServiceName) {
      const match = SERVICES_DATA.find(s => s.name.toLowerCase() === defaultServiceName.toLowerCase());
      if (match) setServiceId(match.id);
    }
  }, [defaultServiceId, defaultServiceName, isOpen]);

  // Reset states when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setErrorMsg(null);
      setBookingSuccess(null);
      setIsCopied(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const selectedService = SERVICES_DATA.find(s => s.id === serviceId) || SERVICES_DATA[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Client-side validation
    if (!customerName.trim() || customerName.trim().length < 2) {
      setErrorMsg('অনুগ্রহ করে আপনার সঠিক নাম প্রদান করুন (কমপক্ষে ২ অক্ষর)।');
      return;
    }

    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 15 || !/^\d+$/.test(cleanPhone)) {
      setErrorMsg('অনুগ্রহ করে সঠিক মোবাইল নম্বর প্রদান করুন (যেমন: 01619487788)।');
      return;
    }

    if (!address.trim() || address.trim().length < 3) {
      setErrorMsg('অনুগ্রহ করে আপনার ঢাকা শহরের সঠিক ঠিকানা প্রদান করুন।');
      return;
    }

    setIsSubmitting(true);

    try {
      const booking = await submitBookingRequest({
        customer_name: customerName.trim(),
        phone: cleanPhone,
        address: address.trim(),
        notes: notes.trim(),
        service_id: selectedService.id,
        service_name: selectedService.name
      });

      setBookingSuccess(booking);
    } catch (err: any) {
      console.error('Booking submission error:', err);
      setErrorMsg(err.message || 'We could not submit your booking right now. Please try again or contact us directly on WhatsApp/Phone.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBookingNumber = () => {
    if (!bookingSuccess?.booking_number) return;
    navigator.clipboard.writeText(bookingSuccess.booking_number);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleWhatsAppBooking = () => {
    if (!bookingSuccess) return;
    const text = `Hello ElectroFix BD, I have submitted a service booking online.\nBooking Number: ${bookingSuccess.booking_number}\nService: ${bookingSuccess.service_name}\nCustomer Name: ${bookingSuccess.customer_name}\nPhone: ${bookingSuccess.phone}\nAddress: ${bookingSuccess.address}`;
    window.open(`https://wa.me/${BUSINESS_CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#DCE3E8] overflow-hidden my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        {/* Modal Header */}
        <div className="bg-[#004179] text-white px-5 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[0.4rem] bg-white/10 flex items-center justify-center border border-white/20" style={{ borderRadius: '0.4rem' }}>
              <Calendar className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 id="booking-modal-title" className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {bookingSuccess ? 'বুকিং নিশ্চিতকরণ' : 'সার্ভিস বুকিং ফর্ম'}
              </h2>
              <p className="text-xs sm:text-sm text-white/80">
                {bookingSuccess ? 'Booking Confirmation' : 'Book a Professional Home Service'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-[0.4rem] transition-colors cursor-pointer"
            style={{ borderRadius: '0.4rem' }}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7">
          {bookingSuccess ? (
            /* ================= Success State ================= */
            <div className="text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border-2 border-emerald-200" style={{ borderRadius: '9999px' }}>
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#17202A]">
                  Booking Request Submitted Successfully
                </h3>
                <p className="text-sm sm:text-base text-[#5F6B76] mt-2 max-w-md mx-auto leading-relaxed">
                  ধন্যবাদ! ElectroFix BD-এ আপনার সার্ভিস রিকোয়েস্ট সফলভাবে জমা হয়েছে। আমাদের টেকনিশিয়ান টিম অতি দ্রুত আপনার দেওয়া নম্বরে কল করে কনফার্ম করবেন।
                </p>
              </div>

              {/* Booking Number Display Card */}
              <div className="bg-[#EAF3F9] border border-[#004179]/20 rounded-[0.4rem] p-4 text-center" style={{ borderRadius: '0.4rem' }}>
                <span className="text-xs sm:text-sm font-semibold text-[#004179] uppercase tracking-wider block mb-1">
                  আপনার ইউনিক বুকিং নম্বর (Booking Number)
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-black text-[#004179] tracking-wider py-1">
                  {bookingSuccess.booking_number}
                </div>
                
                <div className="mt-2.5 flex justify-center">
                  <button
                    id="copy-booking-number-btn"
                    onClick={handleCopyBookingNumber}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-[#004179] text-xs sm:text-sm font-bold rounded-[0.4rem] border border-[#004179]/30 shadow-xs transition-colors cursor-pointer"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[#004179]" />
                        <span>Copy Booking Number</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Summary Details */}
              <div className="text-left bg-[#F5F7F9] rounded-[0.4rem] p-4 border border-[#DCE3E8] text-xs sm:text-sm space-y-2" style={{ borderRadius: '0.4rem' }}>
                <div className="flex justify-between">
                  <span className="text-[#5F6B76]">সার্ভিস:</span>
                  <span className="font-semibold text-[#17202A]">{bookingSuccess.service_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6B76]">কাস্টমার নাম:</span>
                  <span className="font-semibold text-[#17202A]">{bookingSuccess.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6B76]">ফোন নম্বর:</span>
                  <span className="font-semibold text-[#17202A]">{bookingSuccess.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6B76]">ঠিকানা:</span>
                  <span className="font-semibold text-[#17202A]">{bookingSuccess.address}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  id="whatsapp-confirm-btn"
                  onClick={handleWhatsAppBooking}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base rounded-[0.4rem] transition-colors cursor-pointer shadow-sm"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send on WhatsApp</span>
                </button>

                <button
                  onClick={onClose}
                  className="py-3 px-4 bg-[#004179] hover:bg-[#00325E] text-white font-bold text-sm sm:text-base rounded-[0.4rem] transition-colors cursor-pointer shadow-sm"
                  style={{ borderRadius: '0.4rem' }}
                >
                  ঠিক আছে (Close)
                </button>
              </div>
            </div>
          ) : (
            /* ================= Form State ================= */
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-[0.4rem] text-sm text-red-800 flex items-start gap-2 animate-in fade-in" style={{ borderRadius: '0.4rem' }}>
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">{errorMsg}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <a href={getPhoneCallUrl()} className="text-red-900 font-bold underline flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> Call 01619487788
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Selection */}
              <div>
                <label htmlFor="booking-service" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                  সার্ভিস নির্বাচন করুন <span className="text-red-600 font-bold ml-0.5">*</span>
                </label>
                <div className="relative">
                  <select
                    id="booking-service"
                    value={serviceId}
                    onChange={(e) => setServiceId(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] focus:border-transparent transition-all shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    {SERVICES_DATA.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="customer-name" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                    আপনার নাম <span className="text-red-600 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    id="customer-name"
                    required
                    placeholder="যেমন: তানভীর আহমেদ"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] focus:border-transparent placeholder:text-slate-400 transition-all shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  />
                </div>

                <div>
                  <label htmlFor="customer-phone" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                    মোবাইল নম্বর <span className="text-red-600 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    type="tel"
                    id="customer-phone"
                    required
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] focus:border-transparent placeholder:text-slate-400 transition-all shadow-xs font-mono"
                    style={{ borderRadius: '0.4rem' }}
                  />
                </div>
              </div>

              {/* Service Address */}
              <div>
                <label htmlFor="customer-address" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                  সার্ভিস ঠিকানা (ঢাকা শহর) <span className="text-red-600 font-bold ml-0.5">*</span>
                </label>
                <textarea
                  id="customer-address"
                  required
                  rows={2}
                  placeholder="বাড়ি/ফ্ল্যাট নম্বর, রোড, এলাকা (যেমন: বাসা #১২, রোড #৪, মিরপুর-১০, ঢাকা)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] focus:border-transparent placeholder:text-slate-400 resize-none transition-all shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label htmlFor="booking-notes" className="block text-sm sm:text-[15px] font-bold text-[#17202A] mb-1.5">
                  অ্যাপ্লায়েন্সের সমস্যা বা পছন্দের সময় (অপশনাল)
                </label>
                <textarea
                  id="booking-notes"
                  rows={2}
                  placeholder="যেমন: এসিতে ঠান্ডা হচ্ছে না, ব্র্যান্ড জেনারেল, বিকেলে টেকনিশিয়ান আসলে ভালো হয়..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#DCE3E8] rounded-[0.4rem] text-sm sm:text-base text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] focus:border-transparent placeholder:text-slate-400 resize-none transition-all shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                />
              </div>

              {/* Info Note with Standard Readable Font Size */}
              <div className="bg-[#EAF3F9] p-3.5 sm:p-4 rounded-[0.4rem] border border-[#B9D5EC] flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-[#00325e] font-semibold leading-relaxed" style={{ borderRadius: '0.4rem' }}>
                <Wrench className="w-5 h-5 shrink-0 text-[#004179] mt-0.5 sm:mt-0" />
                <span>বুকিং করার পর আমাদের প্রতিনিধি আপনাকে কল করে সময় নিশ্চিত করবেন। কোনো অগ্রিম ফি নেই।</span>
              </div>

              {/* Action Buttons - Standard Readable Typography, Red Cancel Button, Height Matched */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 sm:py-3 h-11 sm:h-12 inline-flex items-center justify-center text-sm sm:text-base font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 border border-red-700 rounded-[0.4rem] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  style={{ borderRadius: '0.4rem' }}
                >
                  বাতিল (Cancel)
                </button>

                <button
                  type="submit"
                  id="confirm-booking-submit-btn"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 sm:py-3 h-11 sm:h-12 inline-flex items-center justify-center bg-[#004179] hover:bg-[#00325E] active:bg-[#002647] text-white text-sm sm:text-base font-bold rounded-[0.4rem] border border-[#00325E] transition-all shadow-md hover:shadow-lg disabled:opacity-60 gap-2 cursor-pointer"
                  style={{ borderRadius: '0.4rem' }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Confirm Booking</span>
                  )}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
};
