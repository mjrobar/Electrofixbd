import React, { useState } from 'react';
import { Phone, MessageCircle, Menu, X, Wrench, Calendar, ChevronRight } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppUrl, getPhoneCallUrl } from '../../data/siteConfig';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenBooking: (serviceName?: string, serviceId?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate, onOpenBooking }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Our Works', path: '/our-works' },
    { name: 'Contact Us', path: '/contact' },
  ];

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 w-full shadow-md">
      {/* Top Announcement Bar */}
      <div className="bg-[#00325E] text-white/90 text-xs py-1.5 px-4 border-b border-[#004179]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>📍 ঢাকা – জরুরি হোম সার্ভিস ও চিপ লেভেল সার্কিট বোর্ড রিপেয়ার</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline font-medium">১০+ বছরের অভিজ্ঞ টেকনিশিয়ান</span>
            <a 
              href={getPhoneCallUrl()} 
              className="flex items-center gap-1.5 text-white font-bold hover:text-emerald-300 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{BUSINESS_CONFIG.phone}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className="bg-[#004179] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            
            {/* Brand Logo */}
            <div className="flex items-center">
              <button 
                id="brand-logo-btn"
                onClick={() => handleLinkClick('/')}
                className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/50 rounded-lg p-1"
                aria-label="ElectroFix BD Home"
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-colors">
                  <Wrench className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-white flex items-center gap-1">
                    ElectroFix <span className="text-emerald-400">BD</span>
                  </div>
                  <div className="text-[10px] text-white/75 font-medium tracking-wide uppercase">
                    Appliance Repair & Service
                  </div>
                </div>
              </button>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
              {navLinks.map((link) => {
                const isActive = currentPath === link.path || (link.path !== '/' && currentPath.startsWith(link.path));
                return (
                  <button
                    key={link.path}
                    id={`nav-link-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleLinkClick(link.path)}
                    className={`px-3.5 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {link.name}
                  </button>
                );
              })}
            </div>

            {/* Desktop Quick Actions */}
            <div className="hidden lg:flex items-center space-x-3">
              <a
                id="nav-whatsapp-btn"
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>

              <button
                id="nav-book-service-btn"
                onClick={() => onOpenBooking()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-[#004179] bg-white hover:bg-slate-100 rounded-md transition-all shadow-sm cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#004179]" />
                <span>Book a Service</span>
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                id="mobile-book-btn"
                onClick={() => onOpenBooking()}
                className="px-2.5 py-1.5 text-xs font-bold text-[#004179] bg-white rounded-md cursor-pointer"
              >
                Book
              </button>
              <button
                id="mobile-menu-toggle-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#00325E] border-t border-[#004179] px-4 pt-3 pb-6 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              {navLinks.map((link) => {
                const isActive = currentPath === link.path || (link.path !== '/' && currentPath.startsWith(link.path));
                return (
                  <button
                    key={link.path}
                    id={`mobile-nav-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleLinkClick(link.path)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-base font-semibold text-left transition-colors cursor-pointer ${
                      isActive ? 'bg-[#004179] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{link.name}</span>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <button
                id="mobile-menu-book-btn"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBooking();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-sm cursor-pointer"
              >
                <Calendar className="w-5 h-5" />
                <span>Book a Service Now</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={getPhoneCallUrl()}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg text-center"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call 01619487788</span>
                </a>
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg text-center"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
