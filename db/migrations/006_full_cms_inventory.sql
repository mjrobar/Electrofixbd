-- Issue 21: additive CMS storage only. No existing customer/editorial row is rewritten.
CREATE TABLE public.cms_documents (
 id text PRIMARY KEY, title text NOT NULL, source_path text NOT NULL,
 mapping_version integer NOT NULL DEFAULT 2, source_ref text NOT NULL DEFAULT 'd8610dcdd87c6fcf6034ec08ca8122fce780627c',
 draft jsonb NOT NULL DEFAULT '{}'::jsonb, published jsonb NOT NULL DEFAULT '{}'::jsonb,
 publication_state text NOT NULL DEFAULT 'uninitialized' CHECK(publication_state IN ('uninitialized','published','unpublished')),
 revision integer NOT NULL DEFAULT 0, archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cms_import_runs (
 id uuid PRIMARY KEY, mapping_version integer NOT NULL DEFAULT 2, snapshot_digest text NOT NULL, preview_digest text NOT NULL,
 before_content jsonb NOT NULL, after_revisions jsonb NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), rolled_back_at timestamptz
);
CREATE TABLE public.cms_publication_state (
 key text PRIMARY KEY CHECK(key IN ('services','works','testimonials','hero_slides','faqs','business_settings','page_sections')),
 state text NOT NULL DEFAULT 'uninitialized' CHECK(state IN ('uninitialized','published','unpublished')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Capture legacy publication status once. Later draft imports must not turn an
-- uninitialized module into an authoritative empty publication merely by revision.
INSERT INTO public.cms_publication_state(key,state)
SELECT v.key, CASE WHEN s.revision>0 THEN CASE WHEN s.published IN ('[]'::jsonb,'{}'::jsonb) THEN 'unpublished' ELSE 'published' END ELSE 'uninitialized' END
FROM (VALUES('services'),('works'),('testimonials'),('hero_slides'),('faqs'),('business_settings'),('page_sections')) AS v(key)
LEFT JOIN public.site_content s ON s.key=v.key;
-- Existing content IDs and authored timestamps remain untouched. Display metadata
-- is separate from operational timestamps and kept nullable for legacy rows.
ALTER TABLE public.services ADD COLUMN sort_order integer;
ALTER TABLE public.works ADD COLUMN legacy_source_id text UNIQUE, ADD COLUMN display_date text NOT NULL DEFAULT '', ADD COLUMN sort_order integer;
ALTER TABLE public.testimonials ADD COLUMN legacy_source_id text UNIQUE, ADD COLUMN display_date text NOT NULL DEFAULT '', ADD COLUMN display_time text NOT NULL DEFAULT '', ADD COLUMN source_created_at text NOT NULL DEFAULT '', ADD COLUMN sort_order integer;
ALTER TABLE public.content_history DROP CONSTRAINT content_history_entity_check;
ALTER TABLE public.content_history ADD CONSTRAINT content_history_entity_check CHECK(entity IN ('services','works','testimonials','site_content','cms_documents'));
CREATE OR REPLACE FUNCTION public.efb_track_change() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE rid text;
BEGIN
 rid := CASE WHEN TG_TABLE_NAME='site_content' THEN to_jsonb(NEW)->>'key' ELSE to_jsonb(NEW)->>'id' END;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME IN ('services','works','testimonials','site_content','cms_documents') THEN
   INSERT INTO public.content_history(entity,record_id,revision,snapshot) VALUES(TG_TABLE_NAME,rid,OLD.revision,to_jsonb(OLD)) ON CONFLICT DO NOTHING;
  END IF;
  NEW.revision := OLD.revision + 1;
  INSERT INTO public.admin_audit(entity,record_id,action,revision) VALUES(TG_TABLE_NAME,rid,'update',NEW.revision);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER efb_track BEFORE UPDATE ON public.cms_documents FOR EACH ROW EXECUTE FUNCTION public.efb_track_change();
DO $$ DECLARE t text;r text; BEGIN
 FOREACH t IN ARRAY ARRAY['cms_documents','cms_import_runs','cms_publication_state'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r);END IF;
  END LOOP;
 END LOOP;
END $$;
