-- OPTIONAL, SEPARATELY REVIEWED Secondary runtime grants after Migration 006.
-- No table data changes. Execute only after owner approval, in a transaction:
-- SELECT set_config('efb.runtime_role','YOUR_EXISTING_RUNTIME_ROLE',true);
-- This file does NOT run through the automatic migration runner.
DO $$
DECLARE runtime text := current_setting('efb.runtime_role'); t text;
BEGIN
 IF runtime IN ('anon','authenticated','service_role','postgres','PUBLIC') OR NOT EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname=runtime AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
 ) THEN RAISE EXCEPTION 'Dedicated nonprivileged runtime role required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('cms_documents','cms_import_runs','cms_publication_state') AND pg_has_role(runtime,c.relowner,'MEMBER'))
 THEN RAISE EXCEPTION 'Runtime must not own the new tables'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND pg_has_role(r.rolname,runtime,'MEMBER'))
 THEN RAISE EXCEPTION 'Browser roles must not inherit runtime privileges'; END IF;
 FOREACH t IN ARRAY ARRAY['cms_documents','cms_import_runs','cms_publication_state','schema_migrations'] LOOP
  EXECUTE format('GRANT SELECT ON public.%I TO %I',t,runtime);
  EXECUTE format('DROP POLICY IF EXISTS efb_runtime_read ON public.%I',t);
  EXECUTE format('CREATE POLICY efb_runtime_read ON public.%I FOR SELECT TO %I USING (true)',t,runtime);
  IF t<>'schema_migrations' THEN
   EXECUTE format('GRANT INSERT,UPDATE ON public.%I TO %I',t,runtime);
   EXECUTE format('DROP POLICY IF EXISTS efb_runtime_insert ON public.%I',t);
   EXECUTE format('DROP POLICY IF EXISTS efb_runtime_update ON public.%I',t);
   EXECUTE format('CREATE POLICY efb_runtime_insert ON public.%I FOR INSERT TO %I WITH CHECK (true)',t,runtime);
   EXECUTE format('CREATE POLICY efb_runtime_update ON public.%I FOR UPDATE TO %I USING (true) WITH CHECK (true)',t,runtime);
  END IF;
 END LOOP;
END $$;
