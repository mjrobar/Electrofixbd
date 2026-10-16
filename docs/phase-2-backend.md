# Phase 2: portable backend foundation

Branch: `feat/phase-2-portable-backend`, based on `main` commit `50b0ed2` (including AGENTS.md).

## Architecture and scope

`server/app.ts` exports `createApp({config, store})` without listening, reading environment files, creating a pool, or running migrations. It owns shared Express routes, validation, security headers, rate limiting, origin checking, bounded JSON parsing, method checks, JSON API 404s and sanitized errors. `shared/api.ts` contains request schemas and types. `server/store.ts` implements parameterized PostgreSQL access through `pg`, with configurable pool/timeouts and no Supabase services or memory persistence. Writes return only after PostgreSQL acknowledges a committed statement.

`server/node.ts` is the separate conventional Node entrypoint. It loads root `.env`, validates configuration, serves only `dist/client` compiled React assets in production (the Node bundle at `dist/server.mjs` is never public), handles SPA deep links, rejects missing assets, and drains connections/pool on SIGINT/SIGTERM. Paths derive from the module location instead of launch working directory. `server.ts` is a development-only bootstrap using dynamically loaded Vite middleware. Production never initializes Vite.

`api/[...path].ts` and `api/index.ts` are thin Vercel development entrypoints; `server/vercel.ts` invokes the same application. They create no listener and run no migrations. Vercel file-based catch-all routing preserves outward `/api/*` URLs; obsolete API-to-API rewrites and duplicated handlers are removed. The adapter supports framework-parsed bodies and returns sanitized errors if configuration initialization fails. Node production requires neither Vercel nor Supabase.

Admin UI, accounts, sessions and privileged APIs are intentionally not started. Existing public components, styling, data, `src/App.tsx`, and `vite.config.ts` are untouched. Frontend API transport is changed only to eliminate false confirmations and direct Supabase writes. The Supabase client dependency is removed; the historical SQL file remains untouched and must not be applied as the portable baseline.

## Configuration and local workflow

Use Node 24 and Bun 1.4.3. Install with `bun install --frozen-lockfile` (or the prepared workspace executable `/workspace/setup-tools/node_modules/.bin/bun`). See `.env.example` for configuration names; enter credentials securely and never commit `.env`.

- `NODE_ENV`: development/test/production. `npm start` defaults to production when absent. Set `NODE_ENV=production` explicitly when reusing a development `.env`.
- `HOST`, `PORT`: defaults `127.0.0.1:3000`; compatible hosting can override the port. Bind `0.0.0.0` only when that host's network boundary requires it.
- `DATABASE_URL`: server-only standard PostgreSQL connection. Production requires this plus an HTTPS `PUBLIC_ORIGIN`. Local frontend-only development can omit it, but status/writes correctly return 503.
- `PUBLIC_ORIGIN`: exact HTTP(S) origin, no path or credentials; local default example is `http://localhost:3000`. Browser submission origin must match it. Use the exact browser host, not a different localhost spelling.
- `DB_POOL_MAX`, `DB_TIMEOUT_MS`: default 5 connections and 5000 ms. Tune for host/serverless concurrency and DB quota.
- `TRUST_PROXY`: `false` by default, or `loopback` only behind a controlled local proxy. No blanket proxy trust; qualify any other provider forwarding setup before deployment.
- `API_RATE_LIMIT`: default 100 requests/minute/source per instance.
- `MIGRATION_DATABASE_URL`: optional distinct operator connection used only by the explicit migration script. `DATABASE_URL` is the fallback.
- `DISABLE_HMR`: existing AI Studio convention remains supported.

Fresh approved development PostgreSQL database setup:

```sh
# Supply the approved development connection securely first.
npm run db:migrate
npm run dev
```

The migration command reads exported variables, not `.env` automatically. Do not put real credentials into shell history or examples. Never run it against a live database without separate approval. The fresh baseline creates services, bookings and contact_messages using standard SQL, UUIDs generated in Node, TIMESTAMPTZ and keyed reference services. It has no Supabase roles/extensions or admin tables. The runner uses an advisory lock, a checksum ledger and a transaction; repeated execution skips unchanged applied migrations. Existing incompatible schemas cause rollback rather than being overwritten. Review/verify an existing DB baseline before adopting it; Supabase export/import and additional content migrations are later work.

Production-style local validation:

```sh
npm run lint
npm run build
NODE_ENV=production npm start
```

Run from the checkout, with configured local PostgreSQL and PUBLIC_ORIGIN. Confirm `/api/health` returns 200/status ok, `/api/status` returns 200/ready true, `/` and public deep links deliver HTML/JS, and missing API/asset paths return 404. No local preview links are required. `/api/status` checks expected columns and runtime SQL privileges, not just configuration presence; it returns 503 when unavailable.

## API contracts and intentional safety changes

- POST `/api/bookings`: existing customer_name, phone, address, notes, service_id and optional service_name inputs remain. Names/text are trimmed, phone punctuation normalized, types/lengths checked and unknown fields rejected. A missing service uses a seeded general service; inactive/unknown IDs are rejected. Database service name is authoritative. Success remains HTTP 201 `{success:true,message,booking}` with the existing confirmation fields and `EFB-YYYYMMDD-XXXXX` reference. Date uses Asia/Dhaka; cryptographic suffix generation has bounded unique-constraint retries.
- GET `/api/bookings/:bookingNumber` and `?bookingNumber=`/`?number=`: return only booking_number, service_name, status and created_at. Customer name, phone, address and notes are deliberately omitted from unauthenticated lookup. Unknown record is 404; invalid reference is 400. Strong private customer tracking/authentication remains later work.
- POST `/api/contact`: preserves name, phone, message and HTTP 200 `{success:true,message}` after a durable insert.
- `/api/health`: liveness only. `/api/status`: provider-neutral readiness; no credential flags, booking counts or raw errors.
- Failures: `{error,code,request_id}`. Validation/JSON 400, origin 403, missing endpoint/record 404, method 405 with Allow, body >16 KiB 413, wrong content type 415, rate limit 429, DB unavailability 503; unexpected errors 500 without sensitive details. Known endpoints support appropriate HEAD/OPTIONS. API failures never become SPA HTML.

`src/lib/bookingClient.ts` no longer generates client bookings or falls back to Supabase/localStorage on submission failures. It requires a successful JSON response and server confirmation. A separate localStorage key caches only new server-confirmed booking responses; old potentially fabricated `electrofix_bookings` records are ignored. This cache is display convenience, not authoritative current status or persistence; clearing it cannot delete server records.

**AI Studio integration review:** confirm booking/contact success and error UI, API client types, normalized phone handling and public lookup. The current public lookup component still has customer-name/phone display rows; anonymous responses now omit those fields for privacy. AI Studio should decide how to present minimal tracking data in a separately reviewed frontend change. Cached confirmations can be stale and contain locally visible customer information; private tracking and cache-retention policy need later review. Public design is unchanged in this phase. Production CSP explicitly permits the existing Unsplash images, Google Fonts and inline presentation styles; scripts and API connections stay same-origin.

## Automated validation

```sh
npm run lint
npm run build
npm test
npm run test:startup
```

`npm test` runs backend contracts through Express and the Vercel adapter, parsing/validation/security/error cases, client failure behavior and configuration checks. Its PostgreSQL test is explicitly skipped unless `TEST_DATABASE_URL` is set to a disposable local database whose name contains `test`. It never uses production DATABASE_URL. The PostgreSQL test applies migrations there, tests repeatability, writes, repository restart, concurrent references, rejected service IDs and constraint failures. It changes only that disposable test schema.

For full persistence and startup validation, supply the disposable local connection in `TEST_DATABASE_URL`, then run `npm test` and `npm run test:startup`. Startup tests launch actual development and built production Node processes, fetch HTML/JS/deep links, inspect API/asset 404s, exercise database-backed submissions and recovery of a booking created by the previous Node process, and require clean SIGTERM exit. Without TEST_DATABASE_URL, startup checks deliberately use an unreachable local DB and verify unavailable readiness, rather than borrowing application credentials.

The onboarding cloud validation used a disposable local PostgreSQL 17 container. Docker is a test convenience, not a production or shared-hosting dependency. On another host, use any qualified local PostgreSQL instance with a disposable test database.

## Special review and remaining limitations

Special-review files: package.json, bun.lock, frontend API client, shared API schemas and vercel.json/build routing. No app-routing or design files changed. AI Studio must import the feature branch explicitly and verify compatibility; automatic workspace sync is not assumed.

`vercel.json` disables Git deployments for non-main branches and retains main deployment, matching the approval workflow. No deployment was initiated. An approved test deployment requires explicitly enabling its branch through a separately reviewed configuration. Vercel file routing and hosting behavior are locally adapter-tested but have not been validated on a live Vercel deployment.

This is a backend foundation, not production launch approval. Admin auth/session/CSRF tokens are later work because no authenticated endpoints exist yet; public JSON writes already enforce configured Origin and content type, with same-origin use and no wildcard credentialed CORS. Current rate limiting is per process, not shared across serverless instances. Production TLS/proxy trust, provider qualification, least-privilege runtime credentials, distributed abuse protection, idempotency after lost responses, full private tracking, backup/restore and legacy schema/data migration require subsequent work. Database timeouts can leave write outcome uncertain; clients must not treat failure as confirmation and a later idempotency design must handle retry duplicates.

The old Supabase SQL policy findings are not repaired on any live database by this change. ARM and Passenger have not been exercised on actual target hosts. Vite's existing \_\_dirname warning remains a future compatibility note. No production database modifications, admin implementation, main merge or deployment are part of Phase 2.
