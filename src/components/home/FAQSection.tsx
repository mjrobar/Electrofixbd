import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Phone, MessageCircle } from 'lucide-react';
import { FAQ_DATA } from '../../data/testimonialsData';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-16 bg-white border-t border-[#DCE3E8]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-10">
          <span className="text-xs font-bold text-[#004179] bg-[#EAF3F9] px-3 py-1 rounded-full uppercase tracking-wider">
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A] mt-2 tracking-tight">
            সাধারণ জিজ্ঞাসা ও উত্তর (FAQ)
          </h2>
          <p className="mt-2 text-sm text-[#5F6B76]">
            সার্ভিস বুকিং, টেকনিশিয়ান ভিজিট এবং অ্যাপ্লায়েন্স সম্পর্কিত সাধারণ প্রশ্নসমূহ।
          </p>
        </div>

        {/* Accordion Container */}
        <div className="space-y-3">
          {FAQ_DATA.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="border border-[#DCE3E8] rounded-xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-4.5 text-left bg-[#F5F7F9] hover:bg-slate-100 flex items-center justify-between gap-4 transition-colors cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base font-bold text-[#17202A] flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-[#004179] shrink-0" />
                    <span>{faq.question}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#5F6B76] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#004179]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="p-4.5 bg-white border-t border-[#DCE3E8]/80 text-xs sm:text-sm text-[#5F6B76] leading-relaxed animate-in fade-in duration-150">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still Have Questions CTA */}
        <div className="mt-10 p-5 rounded-xl bg-[#EAF3F9] border border-[#004179]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h4 className="text-sm font-bold text-[#004179]">আপনার কি অন্য কোনো প্রশ্ন আছে?</h4>
            <p className="text-xs text-[#5F6B76] mt-0.5">আমাদের টেকনিশিয়ানের সাথে সরাসরি কথা বলতে পারেন যেকোনো সময়।</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={getPhoneCallUrl()}
              className="px-4 py-2 bg-[#004179] hover:bg-[#00325E] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{BUSINESS_CONFIG.phone}</span>
            </a>
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};
