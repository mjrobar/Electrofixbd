export const BUSINESS_CONFIG = {
  name: 'ElectroFix BD',
  shortName: 'Electrofixbd',
  tagline: 'Professional Home Appliance Repair & Servicing at Your Doorstep',
  phone: '01619-487788',
  phoneClean: '01619487788',
  phoneInternational: '+8801619487788',
  whatsappNumber: '8801619487788',
  location: 'Dhaka, Bangladesh',
  serviceCoverage: 'All areas of Dhaka — Home Service Available',
  businessHours: 'Open Everyday: 8:00 AM – 10:00 PM',
  experience: '10+ Years Experienced Technician',
  circuitBoardSpecialty: 'Circuit Board Repair – Chip-Level Work',
  facebookUrl: 'https://www.facebook.com/jafransarder',
  youtubeUrl: 'https://www.youtube.com/@ElectroFixBD-d9m',
};

export function getWhatsAppUrl(serviceName?: string): string {
  const number = BUSINESS_CONFIG.whatsappNumber;
  let text = '';
  if (serviceName) {
    text = `Hello ElectroFix BD, I am interested in ${serviceName}. I would like to book or discuss this service for my home in Dhaka.`;
  } else {
    text = `Hello ElectroFix BD, I would like to know more about your appliance repair and servicing services.`;
  }
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function getPhoneCallUrl(): string {
  return `tel:${BUSINESS_CONFIG.phoneClean}`;
}
