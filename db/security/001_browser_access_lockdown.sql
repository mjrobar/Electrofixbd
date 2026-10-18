-- GATED SECURITY MIGRATION. Run only through scripts/secure-database.ts after
-- exporting a full backup and reviewing role/policy preview. No customer rows change.
DO $$
DECLARE t text; r text; p record; runtime text := current_setting('efb.runtime_role');
BEGIN
 IF runtime IN ('anon','authenticated','service_role','postgres','PUBLIC') OR NOT EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname=runtime AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication
 ) THEN RAISE EXCEPTION 'Dedicated non-superuser runtime role required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('bookings','contact_messages','services','works','testimonials','site_content','admin_sessions','content_history','admin_audit','media_assets','review_quotas') AND pg_has_role(runtime,c.relowner,'MEMBER')) THEN RAISE EXCEPTION 'Runtime must not own tables or be a member of their owner roles'; END IF;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) AND pg_has_role(r,runtime,'MEMBER') THEN
   RAISE EXCEPTION 'Browser role must not inherit runtime role';
  END IF;
 END LOOP;
 EXECUTE format('GRANT USAGE ON SCHEMA public TO %I',runtime);
 FOREACH t IN ARRAY ARRAY['services','works','testimonials','bookings','contact_messages','site_content','admin_sessions','content_history','admin_audit','media_assets','review_quotas','schema_migrations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
  END LOOP;
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
    EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r);
   END IF;
  END LOOP;
  IF t<>'schema_migrations' THEN
   EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,runtime);
   EXECUTE format('GRANT SELECT,INSERT ON public.%I TO %I',t,runtime);
   EXECUTE format('CREATE POLICY efb_runtime_read ON public.%I FOR SELECT TO %I USING (true)',t,runtime);
   EXECUTE format('CREATE POLICY efb_runtime_insert ON public.%I FOR INSERT TO %I WITH CHECK (true)',t,runtime);
   IF t NOT IN ('content_history','admin_audit') THEN
    EXECUTE format('GRANT UPDATE ON public.%I TO %I',t,runtime);
    EXECUTE format('CREATE POLICY efb_runtime_update ON public.%I FOR UPDATE TO %I USING (true) WITH CHECK (true)',t,runtime);
   END IF;
   IF t='admin_sessions' THEN
    EXECUTE format('GRANT DELETE ON public.%I TO %I',t,runtime);
    EXECUTE format('CREATE POLICY efb_runtime_delete ON public.%I FOR DELETE TO %I USING (true)',t,runtime);
   END IF;
  END IF;
 END LOOP;
 EXECUTE format('GRANT USAGE ON SEQUENCE public.admin_audit_id_seq TO %I',runtime);
 FOREACH r IN ARRAY ARRAY['PUBLIC','anon','authenticated'] LOOP
  IF r='PUBLIC' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION public.efb_track_change() FROM %s',CASE WHEN r='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r) END);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %s',CASE WHEN r='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r) END);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s',CASE WHEN r='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r) END);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %s',CASE WHEN r='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r) END);
  END IF;
 END LOOP;
END $$;
-- A browser-selectable view owned by the schema owner can bypass base-table RLS.
-- Revoke browser access to views which depend on this application's tables too.
DO $$ DECLARE v record; r text; BEGIN
 FOR v IN
  SELECT DISTINCT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_rewrite rw ON rw.ev_class=c.oid JOIN pg_depend d ON d.objid=rw.oid
  JOIN pg_class base ON base.oid=d.refobjid JOIN pg_namespace bn ON bn.oid=base.relnamespace
  WHERE c.relkind IN ('v','m') AND n.nspname='public' AND bn.nspname='public'
  AND base.relname IN ('bookings','contact_messages','services','works','testimonials','site_content','admin_sessions','content_history','admin_audit','media_assets','review_quotas')
 LOOP
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC',v.nspname,v.relname);
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON %I.%I FROM %I',v.nspname,v.relname,r); END IF;
  END LOOP;
 END LOOP;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r WHERE n.nspname='public' AND p.prosecdef AND r.rolname IN ('anon','authenticated') AND has_function_privilege(r.oid,p.oid,'EXECUTE')) THEN
  RAISE EXCEPTION 'Review browser-callable SECURITY DEFINER functions before lockdown';
 END IF;
END $$;
