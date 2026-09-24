import { Testimonial, FAQItem } from '../types';

export const TESTIMONIALS_DATA: Testimonial[] = [
  {
    id: 'test-1',
    customerName: 'Rahim Hossain',
    location: 'Mirpur-10, Dhaka',
    serviceType: 'AC Repair & Servicing',
    review: 'The technician came to my home in Mirpur on time, inspected the AC cooling coil, and explained the gas pressure issue clearly. The repair was completed cleanly and the cooling is back to new.',
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
    location: 'Dhanmondi, Dhaka',
    serviceType: 'Refrigerator Repair',
    review: 'My refrigerator was not cooling in the lower section, spoiling groceries. The technician diagnosed the defrost sensor issue and repaired it promptly right in our kitchen. Very polite and reliable.',
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
    location: 'Sector 4, Uttara, Dhaka',
    serviceType: 'Washing Machine Repair',
    review: 'Our front-load washing machine had severe drum vibration and spinning noise. The technician replaced the worn bearings and belt at home in Uttara. Saved us huge transportation hassle!',
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
    review: 'The microwave was buzzing loudly and not heating lunch. They handled the high-voltage testing with proper equipment, changed the faulty diode, and tested it thoroughly. Highly recommended.',
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
    location: 'Banani, Dhaka',
    serviceType: 'Circuit Board / Chip-Level Repair',
    review: 'The official service center wanted 18,000 BDT to replace the entire inverter AC motherboard. ElectroFix BD identified the faulty capacitor and repaired the circuit board at chip-level for a fraction of the cost!',
    rating: 5,
    date: '১৫ সেপ্টেম্বর ২০২৬',
    time: 'বিকাল ৫:১০',
    mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-15T17:10:00Z'
  },
  {
    id: 'test-6',
    customerName: 'Mahmudul Hasan',
    location: 'Gulshan-2, Dhaka',
    serviceType: 'Inverter Refrigerator Repair',
    review: 'Our double-door inverter refrigerator stopped cooling suddenly. The ElectroFix BD technician arrived at our Gulshan home promptly, diagnosed the inverter PCB & gas pressure with professional digital gauges, and fixed it the same day. Highly skilled and dependable!',
    rating: 5,
    date: '১৩ সেপ্টেম্বর ২০২৬',
    time: 'দুপুর ৩:০০',
    mediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    createdAt: '2026-09-13T15:00:00Z'
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
    question: 'টেকনিশিয়ান আসার আগে কি অ্যাপ্লায়েন্সের সমস্যা জানাতে হবে?',
    answer: 'সমস্যার ধরন (যেমন: ঠান্ডা হচ্ছে না, আওয়াজ করছে, ডিসপ্লে এরর কোড দেখাচ্ছে ইত্যাদি) এবং ব্র্যান্ডের নাম বুকিংয়ের সময় জানালে টেকনিশিয়ান উপযুক্ত পার্টস ও টেস্ট টুলস নিয়ে দ্রুত পৌঁছাতে পারেন।'
  },
  {
    question: 'AC servicing এবং AC repair এর মধ্যে পার্থক্য কী?',
    answer: 'Servicing হলো মূলত রুটিন মেইনটেন্যান্স—মাস্টার জেট ওয়াশ, ব্লোয়ার ক্লিনিং, ফিল্টার ও ড্রেন লাইন পরিষ্কার। আর Repair হলো যখন নির্দিষ্ট কোনো পার্টস যেমন কম্প্রেসর, ক্যাপাসিটর, সেন্সর, গ্যাস লিকেজ বা সার্কিট বোর্ডে ত্রুটি দেখা দেয়।'
  },
  {
    question: 'ফ্রিজ ঠান্ডা না হলে কী করা উচিত?',
    answer: 'প্রথমে পাওয়ার কানেকশন ও থার্মোস্ট্যাট নব চেক করুন। সমস্যা না মিটলে নিজে গ্যাস পাইপ বা ইলেকট্রিক্যাল অংশে হাত না দিয়ে দ্রুত টেকনিশিয়ানের মাধ্যমে গ্যাস প্রেশার, রিলে ও ডিফ্রস্ট হিটার পরীক্ষা করানো নিরাপদ।'
  },
  {
    question: 'ওয়াশিং মেশিনে পানি না ঢুকলে বা না বের হলে কী কারণ হতে পারে?',
    answer: 'পানি না ঢুকলে ওয়াটার ইনলেট ভালভ বা ফিল্টারে জ্যাম থাকতে পারে। পানি ড্রেন না হলে ড্রেন পাম্পের ইম্পেলারে কয়েন/ময়লা আটকাতে পারে অথবা ড্রেন মোটর খারাপ হতে পারে। টেকনিশিয়ান এসে সহজে এটি পরীক্ষা করে সমাধান করতে পারেন।'
  },
  {
    question: 'মাইক্রোওভেন চালু হচ্ছে কিন্তু খাবার গরম হচ্ছে না—কী করণীয়?',
    answer: 'মাইক্রোওয়েভ ওভেনে ম্যাগনেট্রন, হাই-ভোল্টেজ ডায়োড বা ক্যাপাসিটর নষ্ট হলে খাবার গরম হয় না। মাইক্রোওয়েভে মারাত্মক হাই-ভোল্টেজ থাকে, তাই নিজে কখনোই ব্যাক কভার খুলবেন না; অভিজ্ঞ টেকনিশিয়ানের সাহায্য নিন।'
  },
  {
    question: 'সার্কিট বোর্ড (PCB) রিপেয়ার বা চিপ-লেভেল কাজ কী?',
    answer: 'ইনভার্টার এসি ও ফ্রিজের মূল মাদারবোর্ড অনেক সময় সামান্য একটি ট্রানজিস্টর বা চিপ নষ্ট হওয়ার কারণে অচল হয়ে যায়। সার্ভিস সেন্টার পুরো বোর্ড বদলে ফেলার কথা বলে। আমাদের ১০+ বছরের অভিজ্ঞ টেকনিশিয়ান চিপ-লেভেলে মাইক্রো-সোল্ডারিং করে অল্প খরচে মূল বোর্ডটি সচল করে দেন।'
  },
  {
    question: 'সার্ভিস চার্জ কীভাবে নির্ধারিত হয়?',
    answer: 'অ্যাপ্লায়েন্সের ধরন, কাজের জটিলতা এবং পার্টস পরিবর্তনের প্রয়োজনীয়তার ওপর ভিত্তি করে ন্যায্য চার্জ নির্ধারণ করা হয়। টেকনিশিয়ান পরিদর্শনের পর কাজ শুরুর আগেই আনুমানিক খরচ স্পষ্ট করে জানিয়ে অনুমতি নেন।'
  },
  {
    question: 'নতুন পার্টস লাগলে কী ব্যবস্থা?',
    answer: 'আমরা প্রতিটি অ্যাপ্লায়েন্সের জন্য আসল ও টেকসই কোয়ালিটি পার্টস ব্যবহারের পরামর্শ দিই। পার্টসের মূল্য ও স্পেসিফিকেশন টেকনিশিয়ান সরাসরি কাস্টমারকে বুঝিয়ে দেন।'
  }
];
