-- OPTIONAL, OWNER APPROVAL REQUIRED. Not executed by the baseline migration runner.
-- Apply through the owner's reviewed migration system, never replay 001-006.
-- Adds private Admin state only. Does not UPDATE/DELETE any existing customer/CMS row.
CREATE TABLE public.admin_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  username text NOT NULL CHECK (length(username) BETWEEN 1 AND 150),
  password_hash text NOT NULL CHECK (password_hash ~ '^[a-zA-Z0-9_-]{8,128}:[a-fA-F0-9]{128}$'),
  credential_revision integer NOT NULL DEFAULT 0 CHECK (credential_revision >= 0),
  verified_email text CHECK (verified_email IS NULL OR length(verified_email) BETWEEN 3 AND 254),
  email_verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((verified_email IS NULL) = (email_verified_at IS NULL))
);
CREATE TABLE public.admin_account_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  purpose text NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  credential_version text NOT NULL CHECK (credential_version ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes')
);
CREATE INDEX admin_account_tokens_active ON public.admin_account_tokens(purpose,expires_at) WHERE used_at IS NULL;
CREATE TABLE public.admin_notification_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  seen_at timestamptz NOT NULL,
  seen_booking text NOT NULL CHECK (length(seen_booking) <= 100),
  seen_total integer NOT NULL DEFAULT 0 CHECK (seen_total >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_delivery_outbox (
  id uuid PRIMARY KEY,
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 250),
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  payload text, -- AES-256-GCM envelope, never plaintext PII, tokens or API credentials
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','processing','retry','sent','failed','uncertain','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  available_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  locked_at timestamptz,
  provider_id text CHECK (length(provider_id) <= 250),
  last_code text CHECK (length(last_code) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX admin_delivery_ready ON public.admin_delivery_outbox(available_at,created_at) WHERE state IN ('queued','retry');
CREATE INDEX admin_delivery_processing ON public.admin_delivery_outbox(locked_at) WHERE state='processing';
-- Supports the new read-only feed and calendar analytics without changing rows.
CREATE INDEX bookings_created_cursor ON public.bookings(created_at DESC,booking_number DESC);
DO $$ DECLARE t text; r text; BEGIN
  FOREACH t IN ARRAY ARRAY['admin_owner','admin_account_tokens','admin_notification_state','admin_delivery_outbox'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM %I',t,r);
      END IF;
    END LOOP;
  END LOOP;
END $$;
