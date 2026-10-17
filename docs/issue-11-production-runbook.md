# Issue #11 — one-host production runbook and release gates

This runbook is reviewable preparation, not deployment authorization. No shared
Supabase project, primary database, DNS, VM or hosting configuration was changed.
Supabase/Vercel remain optional development adapters. Runtime is one Node 24 process
serving `dist/client` and Express APIs plus standard PostgreSQL on the final host.

## Safe rollout sequence

1. Owner approves the release and database target after AI Studio compatibility
   review and coordinated acceptance. Keep the old release and a tested full backup.
2. Install Node 24 and PostgreSQL (tested here with disposable PostgreSQL 18.4;
   production requires a supported PostgreSQL version). Build/install dependencies
   using the checked-in package manager lock. In this environment, npm installation
   needed `--legacy-peer-deps` for the inherited Vite 8/esbuild peer mismatch; no
   manifest/lock changes were made. Run lint, local tests, build and startup checks.
3. Use a separate migration-owner connection, explicitly selected for the approved
   target. Run `npm run db:migrate`. Existing legacy installations need the existing
   reviewed `--adopt-existing` procedure from Phase 3. Never run migrations on app
   startup. Migration 004 adds operations metadata; it preserves public fields,
   existing publication flags, original IDs/slugs and customer rows.
4. Create a dedicated LOGIN role with NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION, no schema/table
   ownership and no membership usable by browser roles. Set its password through a
   protected operator channel; never embed credentials in command arguments/history.
   Keep PostgreSQL bound locally/private and firewall it from the Internet.
5. Export and verify a full backup, including roles, grants and policies. Preview
   the gated access-lockdown using **SECURITY_DATABASE_URL**, never inherited
   DATABASE_URL. Inspect table grants/policies, views and SECURITY DEFINER functions.
6. After explicit owner authorization, use the reviewed security migration with
   the runtime role. It revokes PUBLIC/anon/authenticated access to all application
   tables, removes prior permissive policies, enables RLS and installs policies
   scoped only to that runtime role. Dependent public views lose browser grants.
   Browser-callable SECURITY DEFINER functions block the transaction for manual
   review. Default privileges change only for the invoking migration owner; review
   any other object-creator roles separately. No customer/content rows are rewritten.
7. Configure the application with the restricted runtime URL. Production
   `/api/status` must report ready; privileged/owner runtime connections, detectable
   browser grants, missing RLS and dangerous views/functions fail readiness. Verify
   real durable booking/contact writes using an approved acceptance record.
8. Set secure owner credentials, start one managed Node process behind TLS, verify
   static routes/API/admin, then switch traffic only after owner approval. Do not
   assume PR previews prove production readiness.

Preview and approval invocation (placeholders, **not executed against a real DB**):

```sh
# Supply secrets via a protected environment file or secret manager, not shell history.
node --import tsx scripts/secure-database.ts
# Preview requires SECURITY_DATABASE_URL; writes require all gates below:
# SECURITY_DATABASE_URL=<approved migration-owner connection>
# RUNTIME_DATABASE_ROLE=<dedicated restricted role>
# SECURITY_APPROVAL=REVOKE BROWSER DATABASE ACCESS
node --import tsx scripts/secure-database.ts --apply --backup-reviewed
```

The gated SQL is `db/security/001_browser_access_lockdown.sql`. It is deliberately
outside automatic numbered application migrations. This avoids silently changing
primary Supabase public access through a routine schema upgrade. It is transactional
and repeatable. Test and review the grant/policy plan before approving it. The
migration never grants browser users access to customer or admin tables.

## Environment and password handling

Use `.env.example` as the field inventory. A production environment file, mode 0600
and readable only by the service account, needs NODE_ENV=production,
HOST=127.0.0.1, PORT=3000, an exact HTTPS PUBLIC_ORIGIN, the restricted DATABASE_URL,
and ADMIN_USERNAME / ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET. Generate at least
32 random bytes of session secret. Never use a VITE_ prefix for server secrets.
Do not expose operator SECURITY_DATABASE_URL or migration credentials to the Node
process. DB_POOL_MAX defaults to 5; admin and public site controls use bounded pools
of 3 and 2. Budget PostgreSQL connections accordingly for one process.

Generate a salted scrypt hash without putting the password in argv or environment:

```sh
read -rs -p 'New admin password: ' efb_password
printf '%s' "$efb_password" | node --import tsx scripts/hash-admin-password.ts
unset efb_password
```

The helper accepts stdin only and requires 12+ characters. Store only the generated
salt:hash server-side. The login verification uses asynchronous scrypt, constant-time
comparison, generic failure responses and a separate 30-attempt/15-minute IP limit.
One trusted owner account is supported. There is no multi-user role editor, password
reset email or MFA. Rotate the configured password hash/username/secret through the
protected environment procedure; existing sessions are invalidated by credential
fingerprints or secret rotation. Review whether organizational policy requires an
external access gateway/MFA before allowing Internet-facing administration.

## Sessions, privacy and proxy topology

Opaque random session cookies are HttpOnly, SameSite=Strict, scoped to /api/admin,
and Secure in production. PostgreSQL stores keyed token hashes, never raw cookies.
Sessions have 8-hour absolute and 30-minute idle limits. Logout deletes the server
session; Settings can revoke all sessions. Production admin POST/PATCH/PUT/DELETE
requires exact Origin and X-Admin-Request: 1 plus the session. No permissive CORS.

Keep the Node listener bound to loopback and use `deploy/nginx.conf.example` with
TRUST_PROXY=loopback only for a local reverse proxy. For a different topology use
explicit trusted IP/CIDR lists; never true, a hop count, a hostname or /0. The proxy
must replace X-Forwarded-For with the observed client address and clear Forwarded.
Untrusted forwarding headers are rejected. express-rate-limit validation stays on.
Limits are process-local by design for one Node process; horizontal scaling needs
an explicitly shared limiter/session lifecycle review. Do not run an unreviewed
multi-worker deployment and assume limits are shared.

`deploy/electrofix.service` is a systemd template with a dedicated service user,
read-only application tree, protected home/system, private temporary directory and
SIGTERM shutdown. Substitute actual paths and the Node 24 executable. Compatible
shared hosting can run `node dist/server.mjs` under its equivalent process manager,
provided it supports Node 24, PostgreSQL, HTTPS proxy trust and persistent secrets.
The app does not need writable public uploads or a platform filesystem service.

Public tracking explicitly omits customer name, phone, address and internal notes.
Admin search responses are authenticated/no-store; audit entries contain entity,
record ID, revision and time, not messages/phones/addresses/notes. Content history
contains editorial data, including approved testimonial names, and stays private.
Do not log request bodies, cookies, connection URLs or raw driver errors. Operator
security previews contain role/policy metadata but no customer rows. Retain backups
and logs privately under an approved retention policy.

## Backup, restore and rollback

- Before migrations or ACL changes, take a custom-format `pg_dump` and an operator
  `pg_dumpall --globals-only` (where permitted). Use protected libpq service/passfile
  selection, not passwords in argv. Store backups encrypted with restricted access;
  validate restore into a newly created disposable local database before rollout.
- Content import's JSON backup is module-level only, not a full database backup.
  Admin version history restores prior editorial data as a draft and requires
  explicit publication. Archive recovery never republishes automatically.
- Keep the previous release artifact. For application rollback stop traffic, restore
  that artifact and restart against compatible additive schema. Do not reverse a
  security lockdown just to make an old privileged application appear ready.
- Do not drop new columns/tables or restore old backups over current customer writes
  automatically. A database/PITR/ACL rollback needs a separate approved plan using
  the pre-change backup and a maintenance window. No destructive down migration or
  executable unattended restore is supplied.
- Expired sessions are removed on login. History and change logs are append-only
  from the runtime role and intentionally have no automatic pruning; plan an approved
  backup/retention job before sustained production growth.

## Known limits and coordinated acceptance

The primary database's previously reported browser-access risk remains **unverified
and unapplied** until its owner approves the real security migration. No production
readiness certification is made for either shared Supabase project. The restricted
runtime, ACL/RLS and persistence path were verified only in disposable databases.

AI Studio must still connect site JSON controls, resolve empty-publication versus
static-fallback semantics, and resolve the public browser-local review/file form.
See `issue-11-coverage-matrix.md`. Media management is URL-only: no direct upload,
virus scanner, object store, media transcoder, outbound URL fetch or thumbnail proxy.
There are no customer notification/email/SMS integrations or multi-user roles.
These are not simulated by fake success responses.

Owner's single coordinated hands-on acceptance, after automated checks:

- Verify public source/design diffs are absent and approve AI Studio integration.
- Confirm production target/backup/role/security preview, authorize lockdown, then
  verify browser-role table and dependent-view access are denied.
- Confirm HTTPS cookies, exact Origin protection, trusted client IPs, login throttle,
  revocation, idle expiry and credential rotation on the final reverse proxy.
- Submit and track one approved booking and contact; search/filter/update notes and
  statuses in admin, verify public tracking stays private and data survives restart.
- Draft/preview/publish/unpublish services, works and testimonials; test stale edits,
  archive restore and historical draft rollback. Verify slugs remain stable.
- Review hero order/actions, FAQs, business fields and page sections on the separate
  frontend integration; confirm local-only feedback is resolved before launch.
- Compare login, dashboard, bookings, messages, content and settings at 375/768/1440.
- Approve the final release and merge/deployment separately. This PR never auto-merges
  or deploys and does not authorize running destructive tests on any real database.
