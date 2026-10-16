# Phase 4 — Admin Foundation (Draft)

Branch: `feat/admin-dashboard-foundation`

## Implemented
- Mobile-first administrative React UI under `/admin`; public website markup preserved.
- Separate login screen and adaptive dashboard: desktop sidebar, mobile tab bar, overview metrics, latest bookings, booking-status updates, customer inbox and message-status updates.
- Protected `/api/admin/*` endpoints with signed 8-hour HttpOnly SameSite=Strict cookies, origin + custom-header write checks, rate limiting, server-side scrypt password verification and parameterized SQL.
- No administrator credentials stored in browser localStorage or published frontend bundles.
- Content-management cards are placeholders until CRUD endpoints and static-page-to-database migration are implemented.

## Local setup

Use Node.js 24 as requested by the repository engines.

Create a hash by typing a strong password securely into the temporary PowerShell environment, without checking it into Git:
```powershell
$secure = Read-Host "New admin password" -AsSecureString
$password = [System.Net.NetworkCredential]::new("", $secure).Password
$env:EFB_PASSWORD = $password
node -e "const c=require('node:crypto');const salt=c.randomBytes(16).toString('hex');console.log(salt+':'+c.scryptSync(process.env.EFB_PASSWORD,salt,64).toString('hex'))"
Remove-Item Env:EFB_PASSWORD
Remove-Variable password,secure
```

Append these values to the **local** `.env`, **not GitHub**:
```dotenv
ADMIN_USERNAME=your_private_admin_username
ADMIN_PASSWORD_HASH=<scrypt salt:hash printed above>
ADMIN_SESSION_SECRET=<at-least-32-random-characters>
```

Generate a session secret: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`

Ensure `PUBLIC_ORIGIN=http://127.0.0.1:3000` for local development. Restart `npm run dev`, visit `http://127.0.0.1:3000/admin`.

## Verification required before merge
- `npm install`, `npm run lint`, `npm test`, `npm run build` on Node 24.
- Admin login invalid/valid; session expiry, logout, CSRF/origin enforcement, no credential leaks.
- Booking update and message update using **test project** only, with cleanup.
- Google AI Studio compatibility review of `src/App.tsx` and resulting public pages.
- Security review, additional negative tests, session management for multi-admin use, audit trail.
- Real database needs privilege/enum compatibility validation for booking and message status values.
- Admin content editing is **NOT** implemented yet; full nontechnical control needs CRUD APIs and public frontend refactoring in later phase 4 milestones.

Never merge automatically. The live Supabase project contains sensitive customer data.
