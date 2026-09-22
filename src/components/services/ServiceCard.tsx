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
      className="bg-white rounded-xl border border-[#DCE3E8] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group"
    >
      {/* Cover Image Container */}
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
        <span className="absolute bottom-3 left-3 bg-[#004179]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs">
          Home Service Available
        </span>
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 
            onClick={() => onViewDetails(service.slug)}
            className="text-lg font-bold text-[#17202A] group-hover:text-[#004179] transition-colors cursor-pointer line-clamp-1"
          >
            {service.name}
          </h3>

          <p className="mt-2 text-xs sm:text-sm text-[#5F6B76] leading-relaxed line-clamp-2">
            {service.shortDescription}
          </p>

          {/* Quick Problem Highlights */}
          <div className="mt-3.5 pt-3 border-t border-[#DCE3E8]/60 space-y-1.5">
            <span className="text-[11px] font-semibold text-[#17202A] block uppercase tracking-wider text-slate-500">
              কমন সমস্যাসমূহ:
            </span>
            {service.commonProblems.slice(0, 3).map((problem, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-[#5F6B76]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="line-clamp-1">{problem}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 pt-4 border-t border-[#DCE3E8] grid grid-cols-2 gap-2">
          <button
            onClick={() => onViewDetails(service.slug)}
            className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-[#004179] border border-[#004179] text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onBookService(service.name, service.id)}
            className="w-full py-2 px-3 bg-[#004179] hover:bg-[#00325E] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Service</span>
          </button>
        </div>
      </div>
    </div>
  );
};
