-- Additive migration. Do not rewrite existing rows, defaults, IDs, constraints,
-- grants, or RLS policies. The runner checks existing table compatibility first.
CREATE TABLE IF NOT EXISTS public.works (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  service_type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY,
  customer_name TEXT NOT NULL,
  review TEXT NOT NULL,
  service_type TEXT NOT NULL,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  avatar_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Existing works were all public in the checked-in schema. This publication
-- flag enables later moderation; preserve it if the actual database has it.
ALTER TABLE public.works ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
-- Optional testimonial media. Existing avatar/media/rating/publication values
-- and any additional columns remain untouched; new columns are nullable.
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image','video'));
