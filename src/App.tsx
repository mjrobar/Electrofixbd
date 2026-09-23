import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HeroSlider } from './components/home/HeroSlider';
import { AboutSection } from './components/home/AboutSection';
import { TestimonialsSection } from './components/home/TestimonialsSection';
import { FAQSection } from './components/home/FAQSection';
import { EmergencyBanner } from './components/home/EmergencyBanner';
import { ServiceCard } from './components/services/ServiceCard';
import { ServiceDetailView } from './components/services/ServiceDetailView';
import { BookingModal } from './components/services/BookingModal';
import { WorkGallery } from './components/works/WorkGallery';
import { ContactSection } from './components/contact/ContactSection';
import { SERVICES_DATA, getServiceBySlug } from './data/servicesData';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from './data/siteConfig';
import { getLocalBooking } from './lib/bookingClient';
import { Phone, MessageCircle, ArrowRight, ShieldCheck, Wrench, Search, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  
  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedServiceName, setSelectedServiceName] = useState<string | undefined>(undefined);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);

  // Booking Lookup State
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showLookupModal, setShowLookupModal] = useState(false);

  // Listen to browser popstate (Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigate handler with pushState
  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBooking = (serviceName?: string, serviceId?: string) => {
    setSelectedServiceName(serviceName);
    setSelectedServiceId(serviceId);
    setBookingModalOpen(true);
  };

  const handleLookupBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = lookupQuery.trim();
    if (!query) return;
    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(query)}`);
      const text = await res.text();
      let data: any = null;
      if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
        try { data = JSON.parse(text); } catch {}
      }

      if (res.ok && data?.booking) {
        setLookupResult(data.booking);
        return;
      }

      // Check local stored bookings
      const local = getLocalBooking(query);
      if (local) {
        setLookupResult(local);
        return;
      }

      throw new Error(data?.error || 'বুকিং রেকর্ড পাওয়া যায়নি। নম্বরটি আবার পরীক্ষা করুন।');
    } catch (err: any) {
      const local = getLocalBooking(query);
      if (local) {
        setLookupResult(local);
      } else {
        setLookupError(err.message || 'বুকিং খোঁজা সম্ভব হয়নি।');
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  // Route matching
  const isServicesPage = currentPath === '/services';
  const isOurWorksPage = currentPath === '/our-works';
  const isContactPage = currentPath === '/contact';
  const serviceDetailMatch = currentPath.startsWith('/services/') ? currentPath.replace('/services/', '') : null;
  const currentService = serviceDetailMatch ? getServiceBySlug(serviceDetailMatch) : null;
  const isHomePage = currentPath === '/' || (!isServicesPage && !isOurWorksPage && !isContactPage && !serviceDetailMatch);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F9] text-[#17202A] selection:bg-[#004179] selection:text-white">
      
      {/* Primary Navigation */}
      <Navbar
        currentPath={currentPath}
        onNavigate={navigate}
        onOpenBooking={handleOpenBooking}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        
        {/* ==================== 1. HOME PAGE ==================== */}
        {isHomePage && (
          <div className="space-y-0">
            {/* Hero Banner Slider */}
            <HeroSlider
              onOpenBooking={handleOpenBooking}
              onNavigate={navigate}
            />

            {/* Quick Feature Strip - Centered with Red Border on Every Badge (Height 2x Decreased) */}
            <div className="bg-white border-b border-[#DCE3E8] py-8 sm:py-9 px-4 sm:px-6 flex items-center justify-center">
              <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-center gap-3.5 sm:gap-4 md:gap-5 text-sm">
                
                {/* Badge 1: 10+ Years Experience - Red Border on all sides */}
                <div className="flex items-center justify-center text-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-500 bg-white hover:bg-red-50/40 shadow-xs hover:shadow-sm transition-all duration-200">
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                    <ShieldCheck className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="font-bold text-[#17202A] text-xs sm:text-sm">১০+ বছরের অভিজ্ঞ টেকনিশিয়ান</span>
                </div>

                {/* Badge 2: Chip Level Repair - Red Border on all sides */}
                <div className="flex items-center justify-center text-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-500 bg-white hover:bg-red-50/40 shadow-xs hover:shadow-sm transition-all duration-200">
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                    <Wrench className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="font-bold text-[#17202A] text-xs sm:text-sm">চিপ লেভেল সার্কিট বোর্ড রিপেয়ার</span>
                </div>

                {/* Badge 3: Dhaka Home Service - Red Border on all sides */}
                <div className="flex items-center justify-center text-center gap-2.5 px-4 py-2.5 rounded-xl border border-red-500 bg-white hover:bg-red-50/40 shadow-xs hover:shadow-sm transition-all duration-200">
                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  </div>
                  <span className="font-bold text-[#17202A] text-xs sm:text-sm">ঢাকা শহর – দ্রুত হোম সার্ভিস</span>
                </div>

                {/* Badge 4: Track Booking Status - Red Border on all sides */}
                <button
                  onClick={() => setShowLookupModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-red-500 bg-red-50/60 hover:bg-red-600 text-red-700 hover:text-white transition-all duration-200 text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>ট্র্যাক করুন বুকিং স্ট্যাটাস</span>
                </button>

              </div>
            </div>

            {/* Our Services Section */}
            <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-xs font-bold text-[#004179] bg-[#EAF3F9] px-3 py-1 rounded-full uppercase tracking-wider">
                  Our Services
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-[#17202A] mt-2 tracking-tight">
                  আমাদের পেশাদার সার্ভিসসমূহ
                </h2>
                <p className="mt-3 text-sm sm:text-base text-[#5F6B76] leading-relaxed">
                  ElectroFix BD আপনার ঘরের প্রয়োজনীয় সকল ইলেকট্রনিক হোম অ্যাপ্লায়েন্সের যত্ন ও মেরামতে দায়িত্বশীল হোম সার্ভিস প্রদান করে।
                </p>
              </div>

              {/* 3-Column Responsive Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {SERVICES_DATA.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onViewDetails={(slug) => navigate(`/services/${slug}`)}
                    onBookService={(name, id) => handleOpenBooking(name, id)}
                  />
                ))}
              </div>

              {/* View All Services CTA */}
              <div className="mt-12 text-center">
                <button
                  onClick={() => navigate('/services')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#004179] hover:bg-[#00325E] text-white text-sm font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  <span>সকল সার্ভিসের বিস্তারিত বিবরণ দেখুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* Emergency Action Banner */}
            <EmergencyBanner onOpenBooking={() => handleOpenBooking()} />

            {/* About Us Section */}
            <AboutSection onOpenBooking={() => handleOpenBooking()} />

            {/* Customer Reviews Section */}
            <TestimonialsSection />

            {/* FAQ Accordion Section */}
            <FAQSection />
          </div>
        )}

        {/* ==================== 2. ALL SERVICES PAGE ==================== */}
        {isServicesPage && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
            
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-bold text-[#004179] bg-[#EAF3F9] px-3 py-1 rounded-full uppercase tracking-wider">
                Comprehensive Home Care
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#17202A] tracking-tight">
                হোম অ্যাপ্লায়েন্স রিপেয়ার ও সার্ভিসিং
              </h1>
              <p className="text-sm sm:text-base text-[#5F6B76] leading-relaxed">
                ইনভার্টার এসি, রেফ্রিজারেটর, ওয়াশিং মেশিন, মাইক্রোওভেন, ডিশওয়াশার ও সার্কিট বোর্ডের চিপ-লেভেল কাজের জন্য আমাদের সার্ভিস তালিকা থেকে আপনার কাঙ্ক্ষিত সেবাটি বেছে নিন।
              </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {SERVICES_DATA.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onViewDetails={(slug) => navigate(`/services/${slug}`)}
                  onBookService={(name, id) => handleOpenBooking(name, id)}
                />
              ))}
            </div>

            {/* Emergency Banner */}
            <EmergencyBanner onOpenBooking={() => handleOpenBooking()} />

            {/* FAQ Section */}
            <FAQSection />
          </div>
        )}

        {/* ==================== 3. DYNAMIC SERVICE DETAIL PAGE ==================== */}
        {serviceDetailMatch && currentService && (
          <ServiceDetailView
            service={currentService}
            onBackToServices={() => navigate('/services')}
            onOpenBooking={(name, id) => handleOpenBooking(name, id)}
            onNavigateHome={() => navigate('/')}
          />
        )}

        {/* Service Not Found fallback */}
        {serviceDetailMatch && !currentService && (
          <div className="py-20 text-center max-w-md mx-auto px-4">
            <h2 className="text-2xl font-bold text-[#17202A]">Service Not Found</h2>
            <p className="text-sm text-[#5F6B76] mt-2">
              আপনি যে সার্ভিসটি খুঁজছেন তা পাওয়া যায়নি। আমাদের অন্যান্য সার্ভিসগুলো দেখতে পারেন।
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => navigate('/services')}
                className="px-5 py-2.5 bg-[#004179] text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                সকল সার্ভিস দেখুন
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2.5 bg-slate-200 text-[#17202A] text-xs font-bold rounded-lg cursor-pointer"
              >
                হোম পেইজ
              </button>
            </div>
          </div>
        )}

        {/* ==================== 4. OUR WORKS PAGE ==================== */}
        {isOurWorksPage && (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="text-xs font-bold text-[#004179] bg-[#EAF3F9] px-3 py-1 rounded-full uppercase tracking-wider">
                Work Portfolio
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#17202A] tracking-tight">
                আমাদের পূর্ববর্তী কাজের বাস্তব গ্যালারি
              </h1>
              <p className="text-sm sm:text-base text-[#5F6B76]">
                ঢাকার বিভিন্ন এলাকায় আমাদের ১০+ বছরের অভিজ্ঞ টেকনিশিয়ানের সম্পন্নকৃত বাস্তব কাজের নমুনা ও সমাধান বিবরণ।
              </p>
            </div>

            {/* Interactive Filterable Gallery */}
            <WorkGallery onOpenBooking={handleOpenBooking} />

            {/* Emergency Action */}
            <EmergencyBanner onOpenBooking={() => handleOpenBooking()} />
          </div>
        )}

        {/* ==================== 5. CONTACT US PAGE ==================== */}
        {isContactPage && <ContactSection />}

      </main>

      {/* Footer */}
      <Footer
        onNavigate={navigate}
        onOpenBooking={handleOpenBooking}
      />

      {/* Floating Instant Contact Buttons (Bottom Right for Speed & Conversion) */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2.5">
        <a
          id="floating-whatsapp-widget"
          href={getWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white shadow-xl flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
          aria-label="Contact on WhatsApp"
          title="WhatsApp Support"
        >
          <MessageCircle className="w-6 h-6" />
        </a>

        <a
          id="floating-call-widget"
          href={getPhoneCallUrl()}
          className="w-12 h-12 rounded-full bg-[#004179] hover:bg-[#00325E] text-white shadow-xl flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
          aria-label="Call ElectroFix BD"
          title="Call 01619-487788"
        >
          <Phone className="w-5 h-5 text-emerald-300" />
        </a>
      </div>

      {/* Global Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        defaultServiceName={selectedServiceName}
        defaultServiceId={selectedServiceId}
      />

      {/* Booking Lookup Modal */}
      {showLookupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#DCE3E8] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#DCE3E8] pb-3">
              <h3 className="text-base font-bold text-[#17202A]">বুকিং স্ট্যাটাস চেক করুন</h3>
              <button
                onClick={() => {
                  setShowLookupModal(false);
                  setLookupResult(null);
                  setLookupError(null);
                }}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLookupBooking} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  আপনার বুকিং নম্বর (যেমন: EFB-20260922-00421)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="EFB-..."
                    value={lookupQuery}
                    onChange={(e) => setLookupQuery(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-[#DCE3E8] rounded-lg text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-[#004179]"
                  />
                  <button
                    type="submit"
                    disabled={isLookingUp}
                    className="px-4 py-2 bg-[#004179] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>খুঁজুন</span>
                  </button>
                </div>
              </div>

              {lookupError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {lookupError}
                </div>
              )}

              {lookupResult && (
                <div className="p-4 bg-[#EAF3F9] border border-[#004179]/30 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#004179]">বুকিং নম্বর:</span>
                    <span className="font-mono font-bold">{lookupResult.booking_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6B76]">স্ট্যাটাস:</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold capitalize">
                      {lookupResult.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6B76]">সার্ভিস:</span>
                    <span className="font-semibold">{lookupResult.service_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6B76]">গ্রাহকের নাম:</span>
                    <span>{lookupResult.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6B76]">ফোন:</span>
                    <span>{lookupResult.phone}</span>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
