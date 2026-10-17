-- Phase 4B: additive site-controlled content. Apply to development database after backup.
-- This migration never edits existing service, booking, message, work or testimonial rows.
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY CHECK (key IN ('hero_slides','faqs','business_settings','page_sections')),
  draft jsonb NOT NULL DEFAULT '[]'::jsonb,
  published jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.site_content (key,draft,published)
VALUES
  ('hero_slides','[]'::jsonb,'[]'::jsonb),
  ('faqs','[]'::jsonb,'[]'::jsonb),
  ('business_settings','{}'::jsonb,'{}'::jsonb),
  ('page_sections','[]'::jsonb,'[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- Restrict browser and anonymous Supabase roles; API accesses via the server connection.
REVOKE ALL ON public.site_content FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.site_content FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.site_content FROM authenticated;
  END IF;
END $$;
