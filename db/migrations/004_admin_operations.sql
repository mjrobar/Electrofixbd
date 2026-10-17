-- Additive operations metadata. Existing IDs, public fields and publications remain intact.
CREATE TABLE public.admin_sessions (
 token_hash text PRIMARY KEY, credential_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
CREATE INDEX admin_sessions_expiry ON public.admin_sessions(expires_at);
CREATE TABLE public.content_history (
 entity text NOT NULL CHECK(entity IN ('services','works','testimonials','site_content')),
 record_id text NOT NULL, revision integer NOT NULL, snapshot jsonb NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(entity,record_id,revision)
);
CREATE TABLE public.admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity text NOT NULL, record_id text NOT NULL, action text NOT NULL,
 revision integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_created ON public.admin_audit(created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['services','works','testimonials'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN revision integer NOT NULL DEFAULT 0, ADD COLUMN admin_draft jsonb, ADD COLUMN archived_at timestamptz',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['bookings','contact_messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN revision integer NOT NULL DEFAULT 0, ADD COLUMN admin_notes text NOT NULL DEFAULT %L',t,'');
 END LOOP;
END $$;
-- SECURITY INVOKER: runtime role needs explicit history/audit INSERT privileges.
CREATE FUNCTION public.efb_track_change() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE rid text;
BEGIN
 rid := CASE WHEN TG_TABLE_NAME='site_content' THEN to_jsonb(NEW)->>'key' ELSE to_jsonb(NEW)->>'id' END;
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME IN ('services','works','testimonials','site_content') THEN
   INSERT INTO public.content_history(entity,record_id,revision,snapshot)
    VALUES(TG_TABLE_NAME,rid,OLD.revision,to_jsonb(OLD)) ON CONFLICT DO NOTHING;
  END IF;
  NEW.revision := OLD.revision + 1;
  INSERT INTO public.admin_audit(entity,record_id,action,revision) VALUES(TG_TABLE_NAME,rid,'update',NEW.revision);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.efb_track_change() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['services','works','testimonials','site_content','bookings','contact_messages'] LOOP
  EXECUTE format('CREATE TRIGGER efb_track BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.efb_track_change()',t);
 END LOOP;
END $$;
CREATE INDEX bookings_status_created ON public.bookings(status,created_at DESC);
CREATE INDEX contacts_status_created ON public.contact_messages(status,created_at DESC);
-- New private tables never have browser permissions, even on development platforms.
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['admin_sessions','admin_audit','content_history'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r);
   END IF;
  END LOOP;
 END LOOP;
END $$;
