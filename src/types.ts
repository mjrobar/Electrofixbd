export interface Service {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  commonProblems: string[];
  serviceProcess: string[];
  coverImage: string;
  isActive: boolean;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  serviceId: string;
  serviceName: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  status: 'pending' | 'contacted' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface WorkItem {
  id: string;
  title: string;
  slug: string;
  serviceType: string;
  category: 'ac' | 'refrigerator' | 'washing-machine' | 'oven' | 'dishwasher' | 'circuit-board' | 'all';
  description: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  isFeatured?: boolean;
  createdAt?: string;
}

export interface Testimonial {
  id: string;
  customerName: string;
  review: string;
  serviceType: string;
  rating: number;
  avatarUrl?: string;
}

export interface BookingFormData {
  customer_name: string;
  phone: string;
  address: string;
  notes?: string;
  service_id: string;
  service_name: string;
}

export interface ContactFormData {
  name: string;
  phone: string;
  message: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}
