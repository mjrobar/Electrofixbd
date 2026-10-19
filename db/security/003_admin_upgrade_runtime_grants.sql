-- Separate operator review/approval required. Set efb.runtime_role to the existing
-- restricted Node runtime role in this transaction. Never grant browser roles.
DO $$ DECLARE r text := current_setting('efb.runtime_role',true); t text; BEGIN
  IF r IS NULL OR r='' OR r IN ('anon','authenticated','postgres','service_role') OR
    NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r AND rolcanlogin AND NOT (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
  THEN RAISE EXCEPTION 'A restricted dedicated runtime role is required'; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles b WHERE b.rolname IN ('anon','authenticated') AND pg_has_role(b.rolname,r,'MEMBER'))
  THEN RAISE EXCEPTION 'Browser roles must not inherit runtime access'; END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('admin_owner','admin_account_tokens','admin_notification_state','admin_delivery_outbox') AND pg_has_role(r,c.relowner,'MEMBER'))
  THEN RAISE EXCEPTION 'Runtime must not own private tables'; END IF;
  FOREACH t IN ARRAY ARRAY['admin_owner','admin_account_tokens','admin_notification_state','admin_delivery_outbox'] LOOP
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO %I',t,r);
    EXECUTE format('CREATE POLICY efb_admin_runtime ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',t,r);
  END LOOP;
END $$;
