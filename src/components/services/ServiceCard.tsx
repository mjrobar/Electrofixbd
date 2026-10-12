import React from 'react';
import { ArrowRight, Calendar, CheckCircle2 } from 'lucide-react';
import { Service } from '../../types';

interface ServiceCardProps {
  service: Service;
  onViewDetails: (slug: string) => void;
  onBookService: (serviceName: string, serviceId: string) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onViewDetails,
  onBookService,
}) => {
  return (
    <div 
      id={`service-card-${service.slug}`}
      className="bg-white rounded-[0.4rem] border border-[#DCE3E8] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
      style={{ borderRadius: '0.4rem' }}
    >
      {/* Cover Image Container */}
      <div>
        <div 
          className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-100 cursor-pointer"
          onClick={() => onViewDetails(service.slug)}
        >
          <img
            src={service.coverImage}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
          <span 
            className="absolute bottom-3 left-3 bg-[#004179]/95 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-[0.4rem] backdrop-blur-xs border border-white/20 shadow-xs"
            style={{ borderRadius: '0.4rem' }}
          >
            হোম সার্ভিস সুবিধা
          </span>
        </div>

        {/* Card Content */}
        <div className="p-5 sm:p-6 space-y-3">
          <h3 
            onClick={() => onViewDetails(service.slug)}
            className="text-lg sm:text-xl font-bold text-[#17202A] group-hover:text-[#004179] transition-colors cursor-pointer line-clamp-1"
          >
            {service.name}
          </h3>

          <p className="text-sm sm:text-[15px] text-[#5F6B76] leading-relaxed line-clamp-2 font-normal">
            {service.shortDescription}
          </p>

          {/* Quick Problem Highlights - Standard Legible Font Size */}
          <div className="pt-3 border-t border-[#DCE3E8] space-y-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 block uppercase tracking-wide">
              কমন সমস্যাসমূহ:
            </span>
            {service.commonProblems.slice(0, 3).map((problem, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 font-medium leading-normal">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="line-clamp-1">{problem}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons - 100% Bengali, Standard Typography, Zero-slop & Pro spacing */}
      <div className="p-5 sm:p-6 pt-0">
        <div className="pt-4 border-t border-[#DCE3E8] grid grid-cols-2 gap-2.5">
          <button
            onClick={() => onViewDetails(service.slug)}
            className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-[#004179] border border-[#004179] text-xs sm:text-sm font-bold rounded-[0.4rem] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            style={{ borderRadius: '0.4rem' }}
          >
            <span>বিস্তারিত দেখুন</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => onBookService(service.name, service.id)}
            className="w-full py-2.5 px-3 bg-[#004179] hover:bg-[#00325E] text-white text-xs sm:text-sm font-bold rounded-[0.4rem] transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            style={{ borderRadius: '0.4rem' }}
          >
            <Calendar className="w-4 h-4" />
            <span>বুকিং করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
