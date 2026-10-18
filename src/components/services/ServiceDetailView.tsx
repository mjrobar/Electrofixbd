import React from 'react';
import { ArrowLeft, Calendar, MessageCircle, Phone, CheckCircle2, AlertCircle, Wrench, ShieldCheck, ChevronRight } from 'lucide-react';
import { Service } from '../../types';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

interface ServiceDetailViewProps {
  service: Service;
  onBackToServices: () => void;
  onOpenBooking: (serviceName: string, serviceId: string) => void;
  onNavigateHome: () => void;
}

export const ServiceDetailView: React.FC<ServiceDetailViewProps> = ({
  service,
  onBackToServices,
  onOpenBooking,
  onNavigateHome,
}) => {
  return (
    <div className="py-8 sm:py-12 bg-[#F5F7F9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Breadcrumb Navigation - 100% Bengali & Professional */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-[#5F6B76] flex-wrap">
          <button 
            onClick={onNavigateHome} 
            className="hover:text-[#004179] font-medium transition-colors cursor-pointer"
          >
            হোম
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button 
            onClick={onBackToServices} 
            className="hover:text-[#004179] font-medium transition-colors cursor-pointer"
          >
            সার্ভিসসমূহ
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-[#004179]">
            {service.name}
          </span>
        </nav>

        {/* Back Link */}
        <div>
          <button
            onClick={onBackToServices}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#004179] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>সকল সার্ভিসে ফিরে যান</span>
          </button>
        </div>

        {/* Main Service Card */}
        <div 
          className="bg-white rounded-[0.4rem] border border-[#DCE3E8] shadow-sm overflow-hidden"
          style={{ borderRadius: '0.4rem' }}
        >
          {/* Cover Hero Banner */}
          <div className="relative h-64 sm:h-80 lg:h-96 w-full overflow-hidden bg-slate-900">
            <img
              src={service.coverImage}
              alt={service.name}
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent"></div>
            
            <div className="absolute bottom-6 left-6 right-6 text-white space-y-2.5">
              <div 
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[0.4rem] bg-[#004179]/95 backdrop-blur-xs text-xs sm:text-sm font-bold border border-white/20 shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>সমগ্র ঢাকায় সরাসরি হোম সার্ভিস</span>
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                {service.name}
              </h1>
              <p className="text-sm sm:text-base text-white/90 max-w-2xl leading-relaxed font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {service.shortDescription}
              </p>
            </div>
          </div>

          {/* Service Details Body */}
          <div className="p-6 sm:p-10 space-y-8">
            
            {/* Action Bar (Top) */}
            <div 
              className="p-5 sm:p-6 rounded-[0.4rem] bg-[#EAF3F9] border border-[#004179]/20 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs"
              style={{ borderRadius: '0.4rem' }}
            >
              <div className="text-center sm:text-left space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-[#004179]">
                  এই সার্ভিসের জন্য বুকিং করতে চান?
                </h3>
                <p className="text-xs sm:text-sm text-[#5F6B76] font-medium">
                  দক্ষ টেকনিশিয়ান সরাসরি আপনার বাসায় গিয়ে সমাধান করবেন। কোনো অগ্রিম ফি নেই।
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 w-full sm:w-auto shrink-0">
                <button
                  id="service-detail-book-btn"
                  onClick={() => onOpenBooking(service.name, service.id)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#004179] hover:bg-[#00325E] text-white text-xs sm:text-sm font-bold rounded-[0.4rem] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>সার্ভিস বুকিং করুন</span>
                </button>

                <a
                  id="service-detail-whatsapp-btn"
                  href={getWhatsAppUrl(service.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-[0.4rem] transition-colors flex items-center justify-center gap-2 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>হোয়াটসঅ্যাপে যোগাযোগ</span>
                </a>
              </div>
            </div>

            {/* Detailed Description */}
            <div className="space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#004179]" />
                <span>সার্ভিসের বিবরণ ও বৈশিষ্ট্য</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {service.fullDescription}
              </p>
            </div>

            {/* Common Problems Checklist */}
            <div className="pt-6 border-t border-[#DCE3E8] space-y-4">
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#004179]" />
                <span>যেসব সাধারণ সমস্যায় আমরা কাজ করি</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {service.commonProblems.map((prob, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 sm:p-4 rounded-[0.4rem] bg-[#F5F7F9] border border-[#DCE3E8] flex items-start gap-3 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{prob}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Process Roadmap */}
            <div className="pt-6 border-t border-[#DCE3E8] space-y-4">
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#004179]" />
                <span>আমাদের কাজের নির্ভরযোগ্য প্রক্রিয়া</span>
              </h2>
              <div className="space-y-3">
                {service.serviceProcess.map((step, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-[0.4rem] bg-white border border-[#DCE3E8] shadow-xs"
                    style={{ borderRadius: '0.4rem' }}
                  >
                    <div 
                      className="w-8 h-8 rounded-[0.4rem] bg-[#004179] text-white font-bold text-xs sm:text-sm flex items-center justify-center shrink-0"
                      style={{ borderRadius: '0.4rem' }}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-normal">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Call to Action Box */}
            <div 
              className="pt-6 border-t border-[#DCE3E8] bg-[#F5F7F9] p-6 sm:p-8 rounded-[0.4rem] text-center space-y-4 border"
              style={{ borderRadius: '0.4rem' }}
            >
              <h3 className="text-xl sm:text-2xl font-bold text-[#17202A]">
                আপনার {service.name} নিয়ে কোনো সমস্যা হচ্ছে?
              </h3>
              <p className="text-sm sm:text-base text-[#5F6B76] max-w-xl mx-auto font-normal leading-relaxed">
                আমাদের অভিজ্ঞ টেকনিশিয়ানকে আপনার অ্যাপ্লায়েন্সের সমস্যার লক্ষণ জানান। আমরা দ্রুততম সময়ে আপনার বাসায় এসে নিশ্চিত সমাধান প্রদান করব।
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => onOpenBooking(service.name, service.id)}
                  className="px-6 py-3 bg-[#004179] hover:bg-[#00325E] text-white font-bold text-xs sm:text-sm rounded-[0.4rem] transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>অনলাইন বুকিং করুন</span>
                </button>

                <a
                  href={getWhatsAppUrl(service.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-[0.4rem] transition-colors flex items-center gap-2 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp মেসেজ দিন</span>
                </a>

                <a
                  href={getPhoneCallUrl()}
                  className="px-6 py-3 bg-white hover:bg-slate-50 text-[#004179] border border-[#004179] font-bold text-xs sm:text-sm rounded-[0.4rem] transition-colors flex items-center gap-2 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  <Phone className="w-4 h-4 text-[#004179]" />
                  <span>সরাসরি কল: {BUSINESS_CONFIG.phone}</span>
                </a>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
