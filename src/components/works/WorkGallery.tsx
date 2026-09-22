import React, { useState } from 'react';
import { Wrench, MapPin, Calendar, CheckCircle2 } from 'lucide-react';
import { WORKS_DATA } from '../../data/worksData';
import { WorkItem } from '../../types';

interface WorkGalleryProps {
  onOpenBooking: (serviceName?: string) => void;
}

export const WorkGallery: React.FC<WorkGalleryProps> = ({ onOpenBooking }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'সকল কাজ (All Works)' },
    { id: 'ac', label: 'AC Repair' },
    { id: 'refrigerator', label: 'Refrigerator' },
    { id: 'washing-machine', label: 'Washing Machine' },
    { id: 'circuit-board', label: 'Circuit Board / PCB' },
    { id: 'oven', label: 'Microwave Oven' },
    { id: 'dishwasher', label: 'Dishwasher' }
  ];

  const filteredWorks = selectedCategory === 'all'
    ? WORKS_DATA
    : WORKS_DATA.filter(w => w.category === selectedCategory);

  return (
    <div className="space-y-8">
      
      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            id={`filter-cat-${cat.id}`}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-[#004179] text-white shadow-sm'
                : 'bg-white text-[#5F6B76] border border-[#DCE3E8] hover:bg-slate-50 hover:text-[#17202A]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Works Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {filteredWorks.map((work: WorkItem) => (
          <div
            key={work.id}
            className="bg-white rounded-xl border border-[#DCE3E8] overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group"
          >
            <div>
              {/* Media Container */}
              <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-slate-900">
                <img
                  src={work.mediaUrl}
                  alt={work.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <div className="absolute top-3 left-3 bg-[#004179]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs">
                  {work.serviceType}
                </div>
                {work.createdAt && (
                  <div className="absolute bottom-3 left-3 text-white/90 text-xs flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{work.createdAt}</span>
                  </div>
                )}
              </div>

              {/* Work Details */}
              <div className="p-5">
                <h3 className="text-base font-bold text-[#17202A] group-hover:text-[#004179] transition-colors line-clamp-1">
                  {work.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-[#5F6B76] leading-relaxed line-clamp-3">
                  {work.description}
                </p>
              </div>
            </div>

            {/* Bottom Card CTA */}
            <div className="px-5 pb-5 pt-2 border-t border-[#DCE3E8]/60 flex items-center justify-between">
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>সফলভাবে সম্পন্ন</span>
              </span>

              <button
                onClick={() => onOpenBooking(work.serviceType)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#004179] hover:underline cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>বুকিং করুন</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredWorks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-[#DCE3E8] p-8">
          <Wrench className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="text-base font-bold text-[#17202A]">কোনো কাজ পাওয়া যায়নি</h4>
          <p className="text-xs text-[#5F6B76] mt-1">অন্য ক্যাটাগরি সিলেক্ট করুন অথবা সরাসরি আমাদের সাথে যোগাযোগ করুন।</p>
        </div>
      )}

    </div>
  );
};
