import React, { useState, useMemo } from 'react';
import { Tag, Search, Sparkles, ChevronLeft, ChevronRight, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { Service } from '../../types';
import { ServiceCard } from './ServiceCard';
import { EmergencyBanner } from '../home/EmergencyBanner';
import { FAQSection } from '../home/FAQSection';

interface ServicesPageViewProps {
  services: Service[];
  onViewDetails: (slug: string) => void;
  onBookService: (serviceName?: string, serviceId?: string) => void;
}

export const ServicesPageView: React.FC<ServicesPageViewProps> = ({
  services,
  onViewDetails,
  onBookService,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // 3 items per page for clean desktop grid and pagination

  // Service categories matching the exact service list from the Booking Form dropdown
  const categoryFilters = [
    { id: 'all', label: 'সব সার্ভিস' },
    { id: 'ac-repair', label: 'এসি মেরামত ও সার্ভিসিং' },
    { id: 'refrigerator-repair', label: 'রেফ্রিজারেটর ও ফ্রিজ মেরামত' },
    { id: 'washing-machine-repair', label: 'ওয়াশিং মেশিন মেরামত ও সার্ভিসিং' },
    { id: 'oven-repair', label: 'মাইক্রোওয়েভ ওভেন মেরামত' },
    { id: 'dishwasher-repair', label: 'ডিশওয়াশার মেরামত ও সার্ভিসিং' },
    { id: 'circuit-board-repair', label: 'সার্কিট বোর্ড ও চিপ-লেভেল মেরামত' }
  ];

  // Filter logic
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      // Category filter matching service slug
      if (selectedCategory !== 'all') {
        if (service.slug !== selectedCategory) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = service.name.toLowerCase().includes(query);
        const matchesDesc = service.shortDescription.toLowerCase().includes(query) || service.fullDescription.toLowerCase().includes(query);
        const matchesProblems = service.commonProblems.some((p) => p.toLowerCase().includes(query));
        return matchesName || matchesDesc || matchesProblems;
      }

      return true;
    });
  }, [services, selectedCategory, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedServices = filteredServices.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Smooth scroll to services list container
    const container = document.getElementById('services-list-container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
  };

  return (
    <div className="w-full space-y-12 pb-12">
      
      {/* ========================================================================= */}
      {/* 1. DYNAMIC COMPREHENSIVE HOME CARE HEADER (Rich Background Image + Overlay) */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden w-full bg-[#001f3d] text-white border-b border-[#004179]/60 shadow-md">
        {/* Background Image with technician repairing appliance */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&q=80"
            alt="Appliance repair technician at work"
            className="w-full h-full object-cover object-center filter brightness-30"
            loading="eager"
          />
          {/* Deep Navy Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001b33] via-[#002f54]/95 to-[#004179]/85 backdrop-blur-[1px]" />
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Header Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-3xl space-y-4">
            
            {/* Left Side: Current Page Tag / Badge Indicators */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[0.4rem] bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-extrabold uppercase tracking-wider backdrop-blur-xs shadow-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <Tag className="w-3.5 h-3.5 text-emerald-300" />
                <span>সার্ভিসসমূহ</span>
              </div>

              <div 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[0.4rem] bg-white/10 border border-white/20 text-white/90 text-xs font-semibold backdrop-blur-xs"
                style={{ borderRadius: '0.4rem' }}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>হোম কেয়ার ও রিপেয়ার সল্যুশন</span>
              </div>

              <div 
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[0.4rem] bg-[#00386b]/80 border border-white/15 text-white/80 text-xs font-medium"
                style={{ borderRadius: '0.4rem' }}
              >
                <span>📍 সমগ্র ঢাকা সিটি হোম সার্ভিস</span>
              </div>
            </div>

            {/* Main Headline */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                হোম অ্যাপ্লায়েন্স রিপেয়ার ও সার্ভিসিং
              </h1>
              <p className="mt-2 text-sm sm:text-base font-semibold text-emerald-300">
                দক্ষ টেকনিশিয়ান • চিপ-লেভেল সার্কিট বোর্ড মেরামত • জেনুইন স্পেয়ার পার্টস
              </p>
            </div>

            {/* Subtitle / Description */}
            <p className="text-xs sm:text-sm lg:text-base text-white/85 leading-relaxed max-w-2xl">
              ইনভার্টার এসি, রেফ্রিজারেটর, ওয়াশিং মেশিন, মাইক্রোওভেন, ডিশওয়াশার ও সার্কিট বোর্ডের চিপ-লেভেল কাজের জন্য আমাদের নির্ভরযোগ্য সার্ভিস তালিকা থেকে আপনার কাঙ্ক্ষিত সেবাটি বেছে নিন।
            </p>

            {/* Quick Trust Highlights */}
            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/90 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>৬+ স্পেশালাইজড সার্ভিস</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>১০+ বছরের বাস্তব অভিজ্ঞতা</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>১০০% ডোরস্টেপ সার্ভিস</span>
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SERVICES LIST, CATEGORY FILTER & SEARCH CONTAINER */}
      {/* ========================================================================= */}
      <div id="services-list-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24">
        
        {/* Controls Bar: Filter Tabs & Search Bar (Clean, Professional & Free of AI-cliché icons) */}
        <div 
          className="bg-white p-4 sm:p-5 rounded-[0.4rem] border border-[#DCE3E8] shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4"
          style={{ borderRadius: '0.4rem' }}
        >
          
          {/* Category Tabs: Exact Servicing Categories from Booking Form, Text Only, High Typographic Standard */}
          <div className="flex flex-wrap items-center gap-2">
            {categoryFilters.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  id={`service-cat-${cat.id}`}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3.5 py-2 rounded-[0.4rem] text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-[#004179] text-white border border-[#004179]'
                      : 'bg-[#F5F7F9] hover:bg-slate-200 text-[#17202A] border border-[#DCE3E8]'
                  }`}
                  style={{ borderRadius: '0.4rem' }}
                >
                  {cat.label}
                  {cat.id === 'all' ? ` (${services.length})` : ''}
                </button>
              );
            })}
          </div>

          {/* Search Input: Clean, Standard Border Radius */}
          <div className="relative min-w-[240px] sm:min-w-[280px] shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="সার্ভিস বা সমস্যা খুঁজুন..."
              className="w-full pl-9 pr-8 py-2 sm:py-2.5 bg-slate-50 border border-[#DCE3E8] rounded-[0.4rem] text-xs sm:text-sm text-[#17202A] font-medium focus:outline-none focus:ring-2 focus:ring-[#004179] focus:bg-white shadow-xs"
              style={{ borderRadius: '0.4rem' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

        </div>

        {/* Results Counter & Active Status */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-[#5F6B76] px-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#17202A]">
              মোট {filteredServices.length}টি সার্ভিসের মধ্যে {filteredServices.length > 0 ? startIndex + 1 : 0} - {Math.min(filteredServices.length, startIndex + itemsPerPage)} দেখানো হচ্ছে
            </span>
          </div>
          <span className="font-semibold text-[#004179]">
            পৃষ্ঠা {safeCurrentPage} / {totalPages}
          </span>
        </div>

        {/* Services Grid */}
        {paginatedServices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {paginatedServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onViewDetails={onViewDetails}
                onBookService={onBookService}
              />
            ))}
          </div>
        ) : (
          <div 
            className="text-center py-16 bg-white rounded-[0.4rem] border border-dashed border-[#DCE3E8] p-8 space-y-3"
            style={{ borderRadius: '0.4rem' }}
          >
            <p className="text-base font-bold text-[#17202A]">কোনো সার্ভিস পাওয়া যায়নি</p>
            <p className="text-xs sm:text-sm text-[#5F6B76]">অন্য কোনো নাম বা ফিল্টার দিয়ে চেষ্টা করুন।</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 bg-[#004179] text-white text-xs sm:text-sm font-bold rounded-[0.4rem] cursor-pointer shadow-xs"
              style={{ borderRadius: '0.4rem' }}
            >
              ফিল্টার রিসেট করুন
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. PROFESSIONAL PAGINATION CONTROLS */}
        {/* ========================================================================= */}
        {totalPages > 1 && (
          <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#DCE3E8]">
            <p className="text-xs sm:text-sm text-[#5F6B76]">
              পৃষ্ঠা <span className="font-bold text-[#17202A]">{safeCurrentPage}</span> এর <span className="font-bold text-[#17202A]">{totalPages}</span> (মোট {filteredServices.length} টি সার্ভিস)
            </p>

            <nav aria-label="Services pagination" className="inline-flex items-center gap-1.5 sm:gap-2">
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

      {/* ========================================================================= */}
      {/* 4. REDESIGNED EMERGENCY BANNER & FAQ SECTION */}
      {/* ========================================================================= */}
      <div className="space-y-12">
        <EmergencyBanner onOpenBooking={() => onBookService()} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FAQSection />
        </div>
      </div>

    </div>
  );
};
