import { WorkItem } from '../types';

export const WORKS_DATA: WorkItem[] = [
  {
    id: 'work-1',
    title: 'ইনভার্টার এসি পিসিবি চিপ-লেভেল মেরামত',
    slug: 'inverter-ac-pcb-chip-level-repair',
    serviceType: 'সার্কিট বোর্ড মেরামত',
    category: 'circuit-board',
    description: 'ধানমন্ডিতে ১.৫ টন ইনভার্টার এসির মাদারবোর্ডে পুড়ে যাওয়া আইজিবিটি (IGBT) মডিউল এবং মাইক্রোকন্ট্রোলার কমিউনিকেশন লাইন সফলভাবে ডায়াগনসিস ও মেরামত সম্পন্ন। সম্পূর্ণ মাদারবোর্ড না বদলে সাশ্রয়ী খরচে মূল কুলিং পুনরুদ্ধার করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • ধানমন্ডি, ঢাকা'
  },
  {
    id: 'work-2',
    title: 'সাইড-বাই-সাইড রেফ্রিজারেটরের কুলিং সমস্যা সমাধান',
    slug: 'refrigerator-cooling-restoration',
    serviceType: 'রেফ্রিজারেটর মেরামত',
    category: 'refrigerator',
    description: 'গুলশানে ডিফ্রস্ট সেন্সর নষ্ট হয়ে অতিরিক্ত বরফ জমে নিচের চেম্বারে কুলিং বন্ধ হয়ে গিয়েছিল। ত্রুটিপূর্ণ সেন্সর পরিবর্তন, ইভাপোরেটর ড্রেন লাইন পরিষ্কার এবং ডিফ্রস্ট সাইকেল রিক্যালিব্রেশন করে নিখুঁত কুলিং ফিরিয়ে আনা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • গুলশান, ঢাকা'
  },
  {
    id: 'work-3',
    title: 'ফ্রন্ট লোড ওয়াশিং মেশিনের বিয়ারিং ও সিল পরিবর্তন',
    slug: 'washing-machine-bearing-replacement',
    serviceType: 'ওয়াশিং মেশিন মেরামত',
    category: 'washing-machine',
    description: 'উত্তরায় ১২০০ RPM হাই-স্পিড স্পিন সাইকেলে বিকট আওয়াজ ও ঝাঁকুনি হচ্ছিল। গ্রাহকের বাসায় অন-সাইটে সম্পূর্ণ ড্রাম খুলে অরিজিনাল জার্মান গ্রেড ডুয়াল বিয়ারিং ও ওয়াটারপ্রুফ সিল স্থাপন করে সাউন্ডলেস স্মুথ স্পিন নিশ্চিত করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • উত্তরা, ঢাকা'
  },
  {
    id: 'work-4',
    title: 'স্প্লিট এসির মাস্টার ওয়াশ ও কেমিক্যাল জেট সার্ভিসিং',
    slug: 'split-ac-deep-servicing',
    serviceType: 'এসি মেরামত ও সার্ভিসিং',
    category: 'ac',
    description: 'মিরপুর ডিওএইচএসে ডুয়াল স্প্লিট এসির ইনডোর ইভাপোরেটর কয়েল ও ব্লোয়ার হুইল কেমিক্যাল ফোম ট্রিটমেন্ট এবং আউটডোর কন্ডেনসার কয়েল হাই-প্রেশার জেট পাম্প দিয়ে নিখুঁত পরিষ্কার করা হয়েছে। ফলে এয়ারফ্লো ও কুলিং পূর্বের ন্যায় শক্তিশালী হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • মিরপুর ডিওএইচএস, ঢাকা'
  },
  {
    id: 'work-5',
    title: 'ডিজিটাল মাইক্রোওয়েভ ওভেনের ম্যাগনেট্রন ও ডায়োড মেরামত',
    slug: 'microwave-magnetron-diode-repair',
    serviceType: 'মাইক্রোওয়েভ ওভেন মেরামত',
    category: 'oven',
    description: 'বনানীতে ওভেনের পাওয়ার অন ও কাঁচের প্লেট ঘুরলেও খাবার গরম হচ্ছিল না। হাই-ভোল্টেজ ডিসচার্জ করে ক্ষতিগ্রস্ত এইচভি ডায়োড পরিবর্তন এবং ম্যাগনেট্রন ফিলামেন্ট সার্কিট মেরামত করে দ্রুত হিটিং পুনরুদ্ধার করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • বনানী, ঢাকা'
  },
  {
    id: 'work-6',
    title: 'ডিশওয়াশারের ড্রেনেজ পাম্প ও ইম্পেলার ক্লিয়ারিং',
    slug: 'dishwasher-drainage-pump-service',
    serviceType: 'ডিশওয়াশার মেরামত',
    category: 'dishwasher',
    description: 'বসুন্ধরা আবাসিক এলাকায় ইম্পেলার চেম্বারে কাঁচের টুকরা আটকে E24 ড্রেন এরর কোড দেখা দিয়েছিল। ড্রেন চেক-ভালভ ক্লিন, ডিসচার্জ হোস ফ্ল্যাশ এবং স্যানিটারি ওয়াশ টেস্ট করে পানির স্বাভাবিক প্রবাহ নিশ্চিত করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: false,
    createdAt: 'বাস্তব কাজ • বসুন্ধরা আ/এ, ঢাকা'
  },
  {
    id: 'work-7',
    title: 'ইনভার্টার ফ্রিজের কম্প্রেসার ড্রাইভার সার্কিট মেরামত',
    slug: 'inverter-refrigerator-compressor-driver-repair',
    serviceType: 'রেফ্রিজারেটর মেরামত',
    category: 'refrigerator',
    description: 'বারিধারা ডিওএইচএসে ফ্রিজের লাইট জ্বললেও ইনভার্টার কম্প্রেসার স্টার্ট নিচ্ছিল না। আইপিএম (IPM) ড্রাইভার মডিউলের শর্ট-সার্কিট মেরামত, ড্রাইভার আইসি পরিবর্তন ও ইকো-ফ্রেন্ডলি R600a গ্যাস রিচার্জ করে স্বাভাবিক করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • বারিধারা ডিওএইচএস, ঢাকা'
  },
  {
    id: 'work-8',
    title: 'টপ লোড ওয়াশিং মেশিনের ড্রেন মোটর ও ক্লাচ ওভারহোল',
    slug: 'top-load-washing-machine-drain-motor-repair',
    serviceType: 'ওয়াশিং মেশিন মেরামত',
    category: 'washing-machine',
    description: 'মোহাম্মদপুরে পানি ড্রেন না হওয়া এবং স্পিন মোডে যাওয়ার পর মেশিন থেমে এরর কোড দিচ্ছিল। ত্রুটিপূর্ণ ড্রেন মোটর পরিবর্তন, ক্লাচ অ্যাসেম্বলি সার্ভিসিং এবং ৩টি পূর্ণ ওয়াশ সাইকেল চালিয়ে ড্রাম চেক করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: false,
    createdAt: 'বাস্তব কাজ • মোহাম্মদপুর, ঢাকা'
  },
  {
    id: 'work-9',
    title: '২-টন ক্যাসেট এসির কপার পাইপ লিকেজ ব্রেজিং ও গ্যাস চার্জিং',
    slug: 'cassette-ac-pipe-leak-braze-gas-charge',
    serviceType: 'এসি মেরামত ও সার্ভিসিং',
    category: 'ac',
    description: 'লালমাটিয়ায় আউটডোরের ফ্লেয়ার কানেকশনে নাইট্রোজেন প্রেশার টেস্টিংয়ের মাধ্যমে সূক্ষ্ম গ্যাস লিকেজ শনাক্ত করা হয়। সিলভার-ব্রেজিংয়ের মাধ্যমে লিকেজ মেরামত, ৫০০ মাইক্রন ডিপ ভ্যাকুয়াম এবং নির্ধারিত R410A গ্যাস চার্জ সম্পন্ন।',
    mediaUrl: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • লালমাটিয়া, ঢাকা'
  },
  {
    id: 'work-10',
    title: 'মাইক্রো-ইনভার্টার ওভেনের টাচ মেমব্রেন ও ক্যাপাসিটর রিপ্লেসমেন্ট',
    slug: 'microwave-touchpad-capacitor-replacement',
    serviceType: 'মাইক্রোওয়েভ ওভেন মেরামত',
    category: 'oven',
    description: 'উত্তরা সেক্টর ৭-এ ওভেনের টাচ প্যানেল অকার্যকর এবং একটানা গুঞ্জন শব্দ হচ্ছিল। টেকনিক্যাল ডায়াগনসিস করে টেকটাইল কন্ট্রোল মেমব্রেন এবং ফ্যাক্টরি-গ্রেড হাই-ভোল্টেজ অয়েল ক্যাপাসিটর প্রতিস্থাপন করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: false,
    createdAt: 'বাস্তব কাজ • উত্তরা সেক্টর ৭, ঢাকা'
  },
  {
    id: 'work-11',
    title: 'ডুয়াল ইভাপোরেটর ফ্রিজের ডিসি ফ্যান মোটর পরিবর্তন',
    slug: 'french-door-refrigerator-fan-motor-replacement',
    serviceType: 'রেফ্রিজারেটর মেরামত',
    category: 'refrigerator',
    description: 'বসুন্ধরায় ফ্রেশ ফুড চেম্বারে বাতাস না আসায় খাবার নষ্ট হচ্ছিল। জ্যাম হয়ে যাওয়া ব্রাশলেস ডিসি ফ্যান মোটর পরিবর্তন ও ড্যাম্পার ডোর অ্যাকচুয়েটর রিক্যালিব্রেট করে সঠিক তাপমাত্রা বজায় রাখা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • বসুন্ধরা, ঢাকা'
  },
  {
    id: 'work-12',
    title: 'ইনভার্টার এসির মাইক্রোকন্ট্রোলার কমিউনিকেশন বোর্ড মেরামত',
    slug: 'multi-split-ac-communication-pcb-repair',
    serviceType: 'সার্কিট বোর্ড মেরামত',
    category: 'circuit-board',
    description: 'গুলশান ২-এ ইনডোর ও আউটডোরের মধ্যে E7 সিরিয়াল কমিউনিকেশন এরর দেখা দিয়েছিল। সার্কিট বোর্ডের অপ্টোকাপলার আইসোলেশন ও ৫-ভোল্ট লজিক লাইন মেরামত করে ইনভার্টার সিস্টেমকে নিখুঁতভাবে সচল করা হয়েছে।',
    mediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    isFeatured: true,
    createdAt: 'বাস্তব কাজ • গুলশান ২, ঢাকা'
  }
];
