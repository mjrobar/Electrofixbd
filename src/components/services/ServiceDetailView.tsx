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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs sm:text-sm text-[#5F6B76] mb-6 flex-wrap">
          <button 
            onClick={onNavigateHome} 
            className="hover:text-[#004179] transition-colors cursor-pointer"
          >
            Home
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <button 
            onClick={onBackToServices} 
            className="hover:text-[#004179] transition-colors cursor-pointer"
          >
            Services
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-[#17202A] text-[#004179]">
            {service.name}
          </span>
        </nav>

        {/* Back Link */}
        <div className="mb-6">
          <button
            onClick={onBackToServices}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#004179] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>সকল সার্ভিসে ফিরে যান (All Services)</span>
          </button>
        </div>

        {/* Main Service Card */}
        <div className="bg-white rounded-2xl border border-[#DCE3E8] shadow-sm overflow-hidden">
          
          {/* Cover Hero Banner */}
          <div className="relative h-64 sm:h-80 lg:h-96 w-full overflow-hidden bg-slate-900">
            <img
              src={service.coverImage}
              alt={service.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
            
            <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#004179]/90 backdrop-blur-xs text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dhaka Home Service Available</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                {service.name}
              </h1>
              <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed">
                {service.shortDescription}
              </p>
            </div>
          </div>

          {/* Service Details Body */}
          <div className="p-6 sm:p-10 space-y-8">
            
            {/* Action Bar (Top) */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#EAF3F9] border border-[#004179]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#004179]">
                  এই সার্ভিসের জন্য বুকিং করতে চান?
                </h3>
                <p className="text-xs text-[#5F6B76] mt-0.5">
                  দক্ষ টেকনিশিয়ান সরাসরি আপনার বাসায় গিয়ে সমাধান করবেন।
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button
                  id="service-detail-book-btn"
                  onClick={() => onOpenBooking(service.name, service.id)}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#004179] hover:bg-[#00325E] text-white text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book a Service</span>
                </button>

                <a
                  id="service-detail-whatsapp-btn"
                  href={getWhatsAppUrl(service.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contact Now</span>
                </a>
              </div>
            </div>

            {/* Detailed Description */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] mb-3 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#004179]" />
                <span>সার্ভিসের বিবরণ ও বৈশিষ্ট্য</span>
              </h2>
              <p className="text-sm sm:text-base text-[#5F6B76] leading-relaxed">
                {service.fullDescription}
              </p>
            </div>

            {/* Common Problems Checklist */}
            <div className="pt-4 border-t border-[#DCE3E8]">
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#004179]" />
                <span>যেসব সাধারণ সমস্যায় আমরা কাজ করি (Common Problems)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {service.commonProblems.map((prob, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#F5F7F9] border border-[#DCE3E8]/70 flex items-start gap-2.5 text-xs sm:text-sm text-[#17202A]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{prob}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Process Roadmap */}
            <div className="pt-4 border-t border-[#DCE3E8]">
              <h2 className="text-lg sm:text-xl font-bold text-[#17202A] mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#004179]" />
                <span>আমাদের কাজের প্রক্রিয়া (Service Process)</span>
              </h2>
              <div className="space-y-3">
                {service.serviceProcess.map((step, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3.5 p-3 rounded-lg bg-white border border-[#DCE3E8]"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#004179] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-[#17202A]">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Call to Action Box */}
            <div className="pt-6 border-t border-[#DCE3E8] bg-slate-50 p-6 rounded-xl text-center space-y-4">
              <h3 className="text-lg font-extrabold text-[#17202A]">
                আপনার {service.name} নিয়ে কোনো সমস্যা হচ্ছে?
              </h3>
              <p className="text-xs sm:text-sm text-[#5F6B76] max-w-lg mx-auto">
                আমাদের অভিজ্ঞ টেকনিশিয়ানকে আপনার সমস্যার লক্ষণ জানান। আমরা দ্রুততম সময়ে সমাধান প্রদান করতে প্রস্তুত।
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => onOpenBooking(service.name, service.id)}
                  className="px-6 py-3 bg-[#004179] hover:bg-[#00325E] text-white font-bold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book This Service</span>
                </button>

                <a
                  href={getWhatsAppUrl(service.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Message</span>
                </a>

                <a
                  href={getPhoneCallUrl()}
                  className="px-6 py-3 bg-white hover:bg-slate-100 text-[#004179] border border-[#004179] font-bold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2"
                >
                  <Phone className="w-4 h-4 text-[#004179]" />
                  <span>Call {BUSINESS_CONFIG.phone}</span>
                </a>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
