import { Testimonial, FAQItem } from '../types';

export const TESTIMONIALS_DATA: Testimonial[] = [
  {
    id: 'test-1',
    customerName: 'Rahim Hossain',
    location: 'মিরপুর-১০, ঢাকা',
    serviceType: 'AC Repair & Servicing',
    review: 'মিরপুরে আমাদের বাসায় নির্ধারিত সময়েই টেকনিশিয়ান উপস্থিত হন। এসির কুলিং কয়েলের সমস্যা খুব সুন্দরভাবে বুঝিয়ে দিয়ে গ্যাস প্রেশার ঠিক করে দিয়েছেন। কাজ শেষ হওয়ার পর এসি একদম নতুনের মতো ঠান্ডা হচ্ছে। খুবই দক্ষ ও আন্তরিক কাজ।',
    rating: 5,
    date: '২৩ সেপ্টেম্বর ২০২৬',
    time: 'বিকাল ৪:১৫',
    mediaUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-23T16:15:00Z'
  },
  {
    id: 'test-2',
    customerName: 'Nusrat Jahan',
    location: 'ধানমন্ডি, ঢাকা',
    serviceType: 'Refrigerator Repair',
    review: 'ফ্রিজের নিচের অংশে ঠান্ডা হচ্ছিল না, খাবার নষ্ট হয়ে যাচ্ছিল। ধানমন্ডির বাসায় এসে টেকনিশিয়ান ভাই ডিফ্রোস্ট সেন্সরের সমস্যা খুব দ্রুত ঠিক করে দিলেন। রান্নাঘরে কোনো ঝামেলা ছাড়াই পরিষ্কার কাজ করেছেন। সত্যিই বিশ্বস্ত সার্ভিস।',
    rating: 5,
    date: '২২ সেপ্টেম্বর ২০২৬',
    time: 'দুপুর ১২:৩০',
    mediaUrl: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-22T12:30:00Z'
  },
  {
    id: 'test-3',
    customerName: 'Tanvir Ahmed',
    location: 'সেক্টর ৪, উত্তরা, ঢাকা',
    serviceType: 'Washing Machine Repair',
    review: 'উত্তরায় আমাদের ফ্রন্ট-লোড ওয়াশিং মেশিনে অতিরিক্ত ভাইব্রেশন ও ড্রামে বিকট শব্দ হচ্ছিল। টেকনিশিয়ান বাসায় এসে নিখুঁতভাবে বেয়ারিং ও বেল্ট পরিবর্তন করে দিয়েছেন। ভারী মেশিন বাইরে নিয়ে যাওয়ার যন্ত্রণা থেকে বাঁচিয়ে দিলেন।',
    rating: 5,
    date: '২০ সেপ্টেম্বর ২০২৬',
    time: 'সন্ধ্যা ৭:৪৫',
    mediaUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-20T19:45:00Z'
  },
  {
    id: 'test-4',
    customerName: 'Farzana Rahman',
    location: 'Mohammadpur, Dhaka',
    serviceType: 'Microwave Oven Repair',
    review: 'The microwave was buzzing loudly and not heating lunch. They handled the high-voltage testing with proper equipment, changed the faulty diode, and tested it thoroughly. Highly recommended professional home service.',
    rating: 5,
    date: '১৮ সেপ্টেম্বর ২০২৬',
    time: 'সকাল ১১:২০',
    mediaUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-18T11:20:00Z'
  },
  {
    id: 'test-5',
    customerName: 'Imran Kabir',
    location: 'বনানী, ঢাকা',
    serviceType: 'Circuit Board / Chip-Level Repair',
    review: 'ইনভার্টার এসির মাদারবোর্ড নষ্ট হলে অফিসিয়াল সার্ভিস সেন্টার থেকে ১৮,০০০ টাকা দাবি করেছিল। ElectroFix BD চিপ-লেভেলে মাইক্রো-কম্পোনেন্ট মেরামত করে মাত্র ৩,০০০ টাকায় সম্পূর্ণ ঠিক করে দিল! অনেক টাকা বেঁচে গেল।',
    rating: 5,
    date: '১৫ সেপ্টেম্বর ২০২৬',
    time: 'বিকাল ৫:১০',
    mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-15T17:10:00Z'
  },
  {
    id: 'test-6',
    customerName: 'Dr. Mahmudul Hasan',
    location: 'গুলশান-২, ঢাকা',
    serviceType: 'Inverter Refrigerator Repair',
    review: 'ডাবল ডোর ইনভার্টার ফ্রিজে কুলিং বন্ধ হয়ে গিয়েছিল। ডিজিটাল গেজ ও আধুনিক সরঞ্জাম নিয়ে এসে একই দিনে সমাধান করেছেন। কাজের সাথে লিখিত ওয়ারেন্টি পেপার দেওয়ায় বাড়তি নিশ্চিন্ত হয়েছি। গুলশানে এমন সৎ টেকনিশিয়ান পাওয়া কঠিন।',
    rating: 5,
    date: '১৩ সেপ্টেম্বর ২০২৬',
    time: 'দুপুর ৩:০০',
    mediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-13T15:00:00Z'
  },
  {
    id: 'test-7',
    customerName: 'Syed Anisur Rahman',
    location: 'Baridhara DOHS, Dhaka',
    serviceType: 'AC Jet Servicing',
    review: 'Prompt and professional AC master jet wash at Baridhara DOHS. The technician brought high-pressure water pump and protective spill sheets. No water leakage on our wall, cooling is ice cold now.',
    rating: 5,
    date: '১০ সেপ্টেম্বর ২০২৬',
    time: 'সকাল ১০:১৫',
    mediaUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-10T10:15:00Z'
  },
  {
    id: 'test-8',
    customerName: 'Kamrul Islam',
    location: 'বসুন্ধরা আবাসিক এলাকা, ঢাকা',
    serviceType: 'Washing Machine Drain Motor',
    review: 'বসুন্ধরায় ওয়াশিং মেশিনে পানি আটকে গিয়ে ড্রেন হচ্ছিল না। মাত্র ১ ঘণ্টার মধ্যে এসে ড্রেন পাম্পের ময়লা ও ফল্টি মোটর পরিবর্তন করে দিলেন। চার্জ একেবারেই যৌক্তিক ছিল।',
    rating: 5,
    date: '০৮ সেপ্টেম্বর ২০২৬',
    time: 'বিকাল ৪:৪০',
    mediaUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-08T16:40:00Z'
  },
  {
    id: 'test-9',
    customerName: 'Sabina Yasmin',
    location: 'বনশ্রী, ঢাকা',
    serviceType: 'Microwave Touchpad Repair',
    review: 'মাইক্রোওয়েভ ওভেনের কিপ্যাড কাজ করছিল না। রিলে বোর্ড চেক করে চমৎকারভাবে সোল্ডারিং করে দিলেন। পরিবারের সবাই খুব খুশি। অনেক ধন্যবাদ!',
    rating: 5,
    date: '০৫ সেপ্টেম্বর ২০২৬',
    time: 'দুপুর ১:২০',
    mediaUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-05T13:20:00Z'
  }
];

export const FAQ_DATA: FAQItem[] = [
  {
    question: 'কোন কোন appliance repair ও servicing করেন?',
    answer: 'ElectroFix BD ঢাকা শহরে AC (ইনভার্টার ও নন-ইনভার্টার), Refrigerator/Fridge ও Deep Freezer, Washing Machine (Front Load & Top Load), Oven ও Microwave Oven, Dishwasher এবং আধুনিক ইনভার্টার অ্যাপ্লায়েন্সের Circuit Board বা Chip-Level PCB Repair সার্ভিস প্রদান করে।'
  },
  {
    question: 'আপনারা কি বাসায় গিয়ে হোম সার্ভিস দেন?',
    answer: 'হ্যাঁ! ElectroFix BD সম্পূর্ণ ঢাকা শহরে হোম সার্ভিস প্রদান করে। আপনার বাসায় সরাসরি অভিজ্ঞ টেকনিশিয়ান গিয়ে ডায়াগনসিস ও রিপেয়ার কাজ সম্পন্ন করবেন।'
  },
  {
    question: 'সার্ভিস বুকিং কীভাবে করব?',
    answer: 'ওয়েবসাইটের "Book a Service" বাটনে ক্লিক করে নাম, মোবাইল নম্বর এবং ঠিকানা দিয়ে সরাসরি বুকিং করতে পারেন। অথবা সরাসরি কল করতে পারেন: 01619-487788 বা WhatsApp-এ নক করতে পারেন।'
  },
  {
    question: 'বুকিং করার পর কতক্ষণে টেকনিশিয়ান যোগাযোগ করবেন?',
    answer: 'বুকিং রিকোয়েস্ট সাবমিট হওয়ার সাথে সাথেই আমাদের টিম আপনার দেওয়া নম্বরে কল করে সমস্যার বিস্তারিত জেনে সুবিধাজনক সময় নিশ্চিত করে থাকেন।'
  },
  {
    question: 'সার্ভিসিংয়ের জন্য কি কোনো ওয়ারেন্টি পাওয়া যাবে?',
    answer: 'জি, প্রতিটি রিপেয়ার ও পার্টস পরিবর্তনের সাথে ৩০ দিনের লিখিত সার্ভিস ওয়ারেন্টি প্রদান করা হয়। ওয়ারেন্টি চলাকালীন একই ত্রুটিতে সম্পূর্ণ ফ্রি সাপোর্ট দেওয়া হয়।'
  },
  {
    question: 'কী কী পেমেন্ট মেথড গ্রহণ করা হয়?',
    answer: 'ক্যাশ অন ডেলিভারি (Cash on Service), বিকাশ (bKash), নগদ (Nagad), রকেট (Rocket) এবং যেকোনো ব্যাংক ট্রান্সফার।'
  },
  {
    question: 'টেকনিশিয়ান কি জেনুইন স্পেয়ার পার্টস সাথে নিয়ে আসেন?',
    answer: 'হ্যাঁ, আমাদের টেকনিশিয়ানরা প্রয়োজনীয় কমন পার্টস ও প্রফেশনাল টেস্ট কিট সাথে রাখেন। নির্দিষ্ট ব্র্যান্ডের কোনো স্পেসিফিক পার্টসের প্রয়োজন হলে অনুমোদিত ডিস্ট্রিবিউটর থেকে জেনুইন পার্টস সংগ্রহ করে ইন্সটল করা হয়।'
  },
  {
    question: 'জরুরি প্রয়োজনে কত দ্রুত সার্ভিস পাওয়া যায়?',
    answer: 'জরুরি ক্ষেত্রে ঢাকা শহরের মধ্যে কল করার ১ থেকে ২ ঘণ্টার মধ্যে টেকনিশিয়ান উপস্থিত হতে পারেন (ট্রাফিক ও এরিয়া সাপেক্ষে)।'
  }
];
