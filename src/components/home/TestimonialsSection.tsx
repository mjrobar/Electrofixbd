import React from 'react';
import { Star, Quote, CheckCircle2 } from 'lucide-react';
import { TESTIMONIALS_DATA } from '../../data/testimonialsData';

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-16 bg-[#F5F7F9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#004179] bg-[#EAF3F9] px-3 py-1 rounded-full uppercase tracking-wider">
            Customer Feedback
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A] mt-2 tracking-tight">
            কাস্টমারদের অভিজ্ঞতা ও মতামত
          </h2>
          <p className="mt-2 text-sm text-[#5F6B76]">
            ঢাকা শহরে আমাদের টেকনিশিয়ানদের সেবা গ্রহণকারী সন্তুষ্ট গ্রাহকদের কিছু বাস্তব প্রতিক্রিয়া।
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS_DATA.map((item) => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-xl border border-[#DCE3E8] shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                {/* Rating Stars */}
                <div className="flex items-center gap-1 text-amber-400 mb-3">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-sm text-[#17202A] leading-relaxed italic">
                  "{item.review}"
                </p>
              </div>

              {/* Customer Info */}
              <div className="mt-5 pt-4 border-t border-[#DCE3E8]/60 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#17202A] flex items-center gap-1.5">
                    <span>{item.customerName}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-[#004179] font-medium">
                    {item.serviceType}
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-[#EAF3F9] text-[#004179] flex items-center justify-center">
                  <Quote className="w-4 h-4 opacity-50" />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
