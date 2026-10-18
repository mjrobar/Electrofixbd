-- Additive only: historical labels, publications, IDs and drafts are untouched.
ALTER TABLE public.works ADD COLUMN service_id text REFERENCES public.services(id);
ALTER TABLE public.testimonials
 ADD COLUMN service_id text REFERENCES public.services(id),
 ADD COLUMN address text NOT NULL DEFAULT '',
 ADD COLUMN submission_source text NOT NULL DEFAULT 'admin' CHECK(submission_source IN ('admin','customer')),
 ADD COLUMN moderation_status text NOT NULL DEFAULT 'editorial' CHECK(moderation_status IN ('editorial','pending','reviewed')),
 ADD COLUMN consent_at timestamptz,
 ADD COLUMN submission_key uuid UNIQUE,
 ADD COLUMN submission_digest text UNIQUE;
CREATE INDEX works_service_id ON public.works(service_id);
CREATE INDEX testimonials_service_id ON public.testimonials(service_id);
CREATE INDEX testimonials_pending ON public.testimonials(created_at DESC) WHERE submission_source='customer' AND moderation_status='pending' AND archived_at IS NULL;
CREATE TABLE public.media_assets (
 id uuid PRIMARY KEY, filename text UNIQUE NOT NULL,
 mime_type text NOT NULL CHECK(mime_type='image/webp'),
 bytes integer NOT NULL CHECK(bytes>0 AND bytes<=5242880),
 width integer NOT NULL CHECK(width BETWEEN 1 AND 6000),
 height integer NOT NULL CHECK(height BETWEEN 1 AND 6000),
 owner_type text NOT NULL CHECK(owner_type IN ('admin','review')),
 claim_hash text, review_id uuid REFERENCES public.testimonials(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz
);
CREATE INDEX media_assets_review ON public.media_assets(review_id);
CREATE INDEX media_assets_created ON public.media_assets(created_at);
-- Shared durable quota: multiple Node workers must enforce the same daily budget.
CREATE TABLE public.review_quotas (
 bucket text NOT NULL, day date NOT NULL DEFAULT CURRENT_DATE,
 submissions integer NOT NULL DEFAULT 0, uploads integer NOT NULL DEFAULT 0,
 PRIMARY KEY(bucket,day)
);
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['media_assets','review_quotas'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r);
   END IF;
  END LOOP;
 END LOOP;
END $$;
