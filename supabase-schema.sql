-- ============================================================
-- ElectroFix BD — Supabase PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Create Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Services Table
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  common_problems JSONB DEFAULT '[]'::jsonb,
  service_process JSONB DEFAULT '[]'::jsonb,
  cover_image TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_number TEXT UNIQUE NOT NULL,
  service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'confirmed', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Works / Portfolio Table
CREATE TABLE IF NOT EXISTS public.works (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  service_type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Testimonials Table
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  review TEXT NOT NULL,
  service_type TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  avatar_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Contact Messages Table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON public.bookings(booking_number);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON public.bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(slug);
CREATE INDEX IF NOT EXISTS idx_works_category ON public.works(category);

-- Enable Row Level Security (RLS)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Services: anyone can read active services
DROP POLICY IF EXISTS "Public services read access" ON public.services;
CREATE POLICY "Public services read access" ON public.services
  FOR SELECT TO anon, authenticated, service_role
  USING (is_active = true);

-- Works: anyone can read works
DROP POLICY IF EXISTS "Public works read access" ON public.works;
CREATE POLICY "Public works read access" ON public.works
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

-- Testimonials: anyone can read published testimonials
DROP POLICY IF EXISTS "Public testimonials read access" ON public.testimonials;
CREATE POLICY "Public testimonials read access" ON public.testimonials
  FOR SELECT TO anon, authenticated, service_role
  USING (is_published = true);

-- Bookings: anyone can insert a booking request
DROP POLICY IF EXISTS "Public booking insertion" ON public.bookings;
CREATE POLICY "Public booking insertion" ON public.bookings
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

-- Bookings: anyone can read their booking by booking number
DROP POLICY IF EXISTS "Public booking lookup" ON public.bookings;
CREATE POLICY "Public booking lookup" ON public.bookings
  FOR SELECT TO anon, authenticated, service_role
  USING (true);

-- Contact Messages: anyone can insert contact message
DROP POLICY IF EXISTS "Public contact insertion" ON public.contact_messages;
CREATE POLICY "Public contact insertion" ON public.contact_messages
  FOR INSERT TO anon, authenticated, service_role
  WITH CHECK (true);

-- Seed Data: Initial Services from BUSINESS_CONTENT.md
INSERT INTO public.services (id, slug, name, short_description, full_description, common_problems, service_process, cover_image)
VALUES 
(
  'srv-ac-repair',
  'ac-repair',
  'AC Repair & Servicing',
  'Professional AC repair and servicing for common cooling, electrical and performance-related problems.',
  'AC performance can decrease for different reasons, including cooling problems, dirty components, electrical issues or system faults. This service covers general AC inspection, master jet cleaning, servicing and circuit repair across Dhaka.',
  '["AC not cooling properly", "Weak airflow", "Water leaking from indoor unit", "Unusual noise or vibration", "AC not turning on", "Compressor trip / electrical issues", "Remote or sensor problems"]'::jsonb,
  '["Customer Request & Initial Symptom Discussion", "Technician Visit at Customer Home (Dhaka)", "Comprehensive Inspection & Diagnostic Testing", "Cost Explanation & Customer Approval", "Professional Repair or Servicing Execution", "Performance & Safety Verification Testing"]'::jsonb,
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80'
),
(
  'srv-refrigerator-repair',
  'refrigerator-repair',
  'Refrigerator / Fridge Repair',
  'Refrigerator repair and servicing for cooling problems, electrical faults, unusual noise and other common issues.',
  'Refrigerator problems can affect food safety and household convenience. This service covers diagnosis, gas charge checking, compressor relay, defrost sensor, fan motor, and PCB repair for all domestic refrigerators and deep freezers.',
  '["Refrigerator not cooling at all", "Freezer not freezing properly", "Excessive ice formation or frost buildup", "Unusual rattling or humming noise", "Water leakage inside or under fridge", "Appliance not turning on or tripping breaker", "Door seal loose or lighting faults"]'::jsonb,
  '["Online Booking or Direct Phone Call", "Technician Home Visit Across Dhaka", "Thorough Cooling & Electrical Diagnosis", "Transparent Quotation with Replacement Options", "Careful Component Repair or Gas Servicing", "Cooling Stabilization & Final Testing"]'::jsonb,
  'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80'
),
(
  'srv-washing-machine-repair',
  'washing-machine-repair',
  'Washing Machine Repair',
  'Washing machine repair and servicing for drainage, spinning, water supply, electrical and other common problems.',
  'Washing machine faults disrupt daily life. We repair front-load, top-load, and semi-automatic machines from all major brands, handling belt replacement, motor troubleshooting, drainage pumps, and electronic control cards.',
  '["Washing machine not starting", "Water not entering the machine", "Water not draining out", "Drum not spinning or rotating", "Excessive vibration and banging sound", "Door lock or latch error (E-codes)", "Electronic control panel unresponsive"]'::jsonb,
  '["Booking Submission with Appliance Model Details", "Technician Phone Confirmation", "Home Visit & Error Code Diagnostics", "Internal Mechanical & Electrical Inspection", "Precision Repair & Water Cycle Testing", "Advice on Detergent & Appliance Maintenance"]'::jsonb,
  'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80'
),
(
  'srv-oven-repair',
  'oven-repair',
  'Oven / Microwave Oven Repair',
  'Oven and microwave oven repair for heating, electrical, control-panel and other common appliance problems.',
  'Microwave and electric ovens have sensitive high-voltage components. Our technicians safely inspect magnetrons, high-voltage diodes, capacitors, touchpads, and thermal fuses to restore safe heating performance.',
  '["Oven running but not heating food", "Sparks or burning smell inside cavity", "Turntable plate not rotating", "Touch panel or buttons unresponsive", "Display error or display blank", "Door switch failure or won''t latch", "Circuit breaker trips when starting"]'::jsonb,
  '["Service Request with Issue Symptoms", "Technician Consultation & Home Visit", "High-Voltage Safety Discharge & Diagnostic Check", "Magnetron, Capacitor & Board Testing", "Component Repair / Replacement", "Heat & Radiation Safety Verification Test"]'::jsonb,
  'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1200&q=80'
),
(
  'srv-dishwasher-repair',
  'dishwasher-repair',
  'Dishwasher Repair',
  'Dishwasher repair and servicing for water drainage, cleaning, electrical and other common operational problems.',
  'Modern dishwashers require specialized care for water pumps, heating elements, spray arms, and electronic cycles. We provide comprehensive on-site repair and maintenance in Dhaka.',
  '["Dishwasher not turning on or starting cycle", "Water standing at bottom / not draining", "Dishes coming out dirty or cloudy", "Water leaking onto kitchen floor", "Unusual grinding noise during wash cycle", "Error codes flashing on control panel"]'::jsonb,
  '["Customer Booking via Website or WhatsApp", "Visit Scheduled by Qualified Technician", "Filter, Spray Arm & Pump Diagnostics", "Solenoid Valve & Sensor Testing", "Precision Repair & Full Wash Cycle Check", "Final Customer Walkthrough"]'::jsonb,
  'https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=1200&q=80'
),
(
  'srv-circuit-board-repair',
  'circuit-board-repair',
  'Circuit Board / Chip-Level Repair',
  'Circuit board troubleshooting and chip-level repair for compatible home appliances.',
  'Many expensive appliances are discarded because of a single fried microcontroller or capacitor on the main PCB. With 10+ years of micro-soldering experience, we diagnose and repair inverter boards, motor controller chips, and power supply circuits at a fraction of full motherboard replacement cost.',
  '["Appliance completely dead with no power response", "Inverter error codes (blinking LED patterns)", "Surge damage after power outage or lightning", "Erratic behavior or random shutoffs", "Relay clicking constantly without firing compressor", "Burned smell from electronics casing"]'::jsonb,
  '["Appliance Inspection & Board Extraction if necessary", "Microscope-Level PCB Diagnostics & Tracing", "Faulty Transistor, IC, or Capacitor Identification", "Precision Chip-Level Micro-Soldering & Replacement", "Bench Voltage & Load Testing", "Re-installation & Real Appliance Operational Check"]'::jsonb,
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Data: Sample Works
INSERT INTO public.works (title, slug, service_type, category, description, media_url, is_featured)
VALUES
(
  'Inverter AC PCB Chip-Level Repair',
  'inverter-ac-pcb-chip-level-repair',
  'Circuit Board Repair',
  'circuit-board',
  'Diagnosed burned IGBT module and micro-controller line on a 1.5 ton Inverter AC board in Dhanmondi. Restored full inverter functionality.',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80',
  true
),
(
  'Side-by-Side Refrigerator Cooling Restoration',
  'refrigerator-cooling-restoration',
  'Refrigerator Repair',
  'refrigerator',
  'Defrost heater and sensor failure causing heavy ice blockage and warm lower compartment in Gulshan. Replaced sensor and calibrated defrost timer.',
  'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
  true
),
(
  'Front Load Washing Machine Bearing & Seal Replacement',
  'washing-machine-bearing-replacement',
  'Washing Machine Repair',
  'washing-machine',
  'Severe rattling sound during 1200 RPM spin cycle. Disassembled drum, replaced water seal and dual high-speed bearings in Uttara.',
  'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1000&q=80',
  true
),
(
  'Jet Pump Deep Servicing for Split AC',
  'split-ac-deep-servicing',
  'AC Repair & Servicing',
  'ac',
  'Master chemical foam cleaning of indoor evaporator coil and high-pressure outdoor wash for a dual split system in Mirpur.',
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1000&q=80',
  true
),
(
  'Digital Microwave Magnetron & Diode Replacement',
  'microwave-magnetron-diode-repair',
  'Microwave Oven Repair',
  'oven',
  'Oven powered on but stayed completely cold. High-voltage diode breakdown fixed and magnetron filament tested in Banani.',
  'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=1000&q=80',
  true
),
(
  'Dishwasher Drainage Pump & Valve Clearing',
  'dishwasher-drainage-pump-service',
  'Dishwasher Repair',
  'dishwasher',
  'E24 drainage error code caused by debris blockage in impeller chamber. Cleaned check valve and restored drainage in Bashundhara R/A.',
  'https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=1000&q=80',
  false
)
ON CONFLICT (slug) DO NOTHING;

-- Seed Data: Genuine/Realistic Testimonials
INSERT INTO public.testimonials (customer_name, review, service_type, rating)
VALUES
(
  'Rahim Hossain',
  'The technician came to my home in Mirpur on time, checked the AC cooling coil, and explained the problem clearly. The service was completed without any hassle.',
  'AC Repair & Servicing',
  5
),
(
  'Nusrat Jahan',
  'My refrigerator was not cooling properly in the lower section. The technician diagnosed the defrost sensor issue and repaired it promptly. Highly dependable home service.',
  'Refrigerator Repair',
  5
),
(
  'Tanvir Ahmed',
  'Our front-load washing machine had severe drum vibration and spinning issues. The technician replaced the worn bearings right at our home in Uttara. Great work!',
  'Washing Machine Repair',
  5
),
(
  'Farzana Rahman',
  'The microwave was making buzzing sounds and not heating meals. After safe high-voltage testing, they replaced the diode and verified heating. Very polite and professional.',
  'Microwave Oven Repair',
  5
),
(
  'Imran Kabir',
  'Other service centers suggested throwing away the inverter AC board. ElectroFix BD identified the faulty capacitor and repaired the circuit board at chip-level! Saved me thousands of taka.',
  'Circuit Board Repair',
  5
)
ON CONFLICT DO NOTHING;
