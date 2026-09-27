import React, { useState } from 'react';
import { Wrench, MapPin, Calendar, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { WORKS_DATA } from '../../data/worksData';
import { WorkItem } from '../../types';

interface WorkGalleryProps {
  onOpenBooking: (serviceName?: string) => void;
}

export const WorkGallery: React.FC<WorkGalleryProps> = ({ onOpenBooking }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // 6 per page as requested by user

  const totalWorks = WORKS_DATA.length;
  const totalPages = Math.ceil(totalWorks / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedWorks = WORKS_DATA.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    const container = document.getElementById('works-gallery-container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="works-gallery-container" className="space-y-6 scroll-mt-24">
      
      {/* Results Counter & Active Status Bar (Matching Services Page) */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-[#5F6B76] px-1 pb-1 border-b border-[#DCE3E8]/80">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#17202A]">
            মোট {totalWorks}টি কাজের মধ্যে {startIndex + 1} - {Math.min(totalWorks, startIndex + itemsPerPage)} দেখানো হচ্ছে
          </span>
        </div>
        <span className="font-semibold text-[#004179]">
          পৃষ্ঠা {safeCurrentPage} / {totalPages}
        </span>
      </div>

      {/* Works Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {paginatedWorks.map((work: WorkItem) => (
          <div
            key={work.id}
            className="bg-white rounded-[0.4rem] border border-[#DCE3E8] overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group"
            style={{ borderRadius: '0.4rem' }}
          >
            <div>
              {/* Media Container */}
              <div className="relative h-48 sm:h-54 w-full overflow-hidden bg-slate-900">
                <img
                  src={work.mediaUrl}
                  alt={work.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"></div>
                <div 
                  className="absolute top-3 left-3 bg-[#004179]/95 text-white text-xs sm:text-sm font-bold px-3 py-1 rounded-[0.4rem] backdrop-blur-xs border border-white/20 shadow-xs"
                  style={{ borderRadius: '0.4rem' }}
                >
                  {work.serviceType}
                </div>
                {work.createdAt && (
                  <div className="absolute bottom-3 left-3 text-white text-xs sm:text-sm flex items-center gap-1.5 font-semibold">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{work.createdAt}</span>
                  </div>
                )}
              </div>

              {/* Work Details - Legible Standard Typography */}
              <div className="p-5 sm:p-6 space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-[#17202A] group-hover:text-[#004179] transition-colors line-clamp-1">
                  {work.title}
                </h3>
                <p className="text-sm sm:text-[15px] text-[#5F6B76] leading-relaxed line-clamp-3 font-normal">
                  {work.description}
                </p>
              </div>
            </div>

            {/* Bottom Card CTA - Standard Font Size */}
            <div className="px-5 pb-5 pt-3.5 border-t border-[#DCE3E8] flex items-center justify-between">
              <span className="text-xs sm:text-sm text-emerald-800 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>সফলভাবে সম্পন্ন</span>
              </span>

              <button
                onClick={() => onOpenBooking(work.serviceType)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#004179] hover:bg-[#00325E] text-white text-xs sm:text-sm font-bold rounded-[0.4rem] transition-colors cursor-pointer shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>বুকিং করুন</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* PROFESSIONAL PAGINATION CONTROLS (Identical to Services Page) */}
      {/* ========================================================================= */}
      {totalPages > 1 && (
        <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#DCE3E8]">
          <p className="text-xs sm:text-sm text-[#5F6B76]">
            পৃষ্ঠা <span className="font-bold text-[#17202A]">{safeCurrentPage}</span> এর <span className="font-bold text-[#17202A]">{totalPages}</span> (মোট {totalWorks} টি কাজ)
          </p>

          <nav aria-label="Our Works pagination" className="inline-flex items-center gap-1.5 sm:gap-2">
            {/* Previous Page Button */}
            <button
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="px-3.5 py-2 rounded-[0.4rem] text-xs sm:text-sm font-bold border border-[#DCE3E8] bg-white text-[#17202A] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              style={{ borderRadius: '0.4rem' }}
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">পূর্ববর্তী</span>
            </button>

            {/* Page Number Buttons */}
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isCurrent = pageNum === safeCurrentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`min-w-[38px] h-[38px] rounded-[0.4rem] text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center ${
                    isCurrent
                      ? 'bg-[#004179] text-white shadow-md scale-105'
                      : 'bg-white hover:bg-slate-50 text-[#17202A] border border-[#DCE3E8]'
                  }`}
                  style={{ borderRadius: '0.4rem' }}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Page Button */}
            <button
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="px-3.5 py-2 rounded-[0.4rem] text-xs sm:text-sm font-bold border border-[#DCE3E8] bg-white text-[#17202A] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
              style={{ borderRadius: '0.4rem' }}
              aria-label="Next Page"
            >
              <span className="hidden sm:inline">পরবর্তী</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        </div>
      )}

    </div>
  );
};
