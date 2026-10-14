-- Fresh database baseline only. Existing Supabase databases require a reviewed
-- baseline/import plan; do not apply blindly to an existing schema.
CREATE TABLE public.services (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  full_description TEXT NOT NULL DEFAULT '',
  common_problems JSONB NOT NULL DEFAULT '[]',
  service_process JSONB NOT NULL DEFAULT '[]',
  cover_image TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY,
  booking_number TEXT UNIQUE NOT NULL,
  service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','confirmed','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_status ON public.bookings(status);
INSERT INTO public.services (id,slug,name) VALUES
 ('srv-general','general','General Appliance Servicing'),
 ('srv-ac-repair','ac-repair','এসি মেরামত ও সার্ভিসিং'),
 ('srv-refrigerator-repair','refrigerator-repair','রেফ্রিজারেটর ও ফ্রিজ মেরামত'),
 ('srv-washing-machine-repair','washing-machine-repair','ওয়াশিং মেশিন মেরামত ও সার্ভিসিং'),
 ('srv-oven-repair','oven-repair','মাইক্রোওয়েভ ওভেন মেরামত'),
 ('srv-dishwasher-repair','dishwasher-repair','ডিশওয়াশার মেরামত'),
 ('srv-circuit-board-repair','circuit-board-repair','সার্কিট বোর্ড ও চিপ-লেভেল মেরামত');
-- No provider roles, Auth, Storage, extensions, or public anonymous grants.
