import React, { useEffect, useState } from "react";
import SecurityPanel from "./SecurityPanel";
import BrandingPanel from "./BrandingPanel";
import {
  adminRequest,
  canLeaveAdmin,
  Feedback,
  ui,
  useUnsavedChanges,
  type Row,
} from "./ui";
export default function SettingsPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState("account");
  return (
    <div className="space-y-5">
      <nav className="efb-settings-tabs" aria-label="Settings sections">
        {[
          ["account", "Account & recovery"],
          ["branding", "Website branding"],
          ["delivery", "Delivery integrations"],
          ["security", "Sessions & audit"],
        ].map(([key, label]) => (
          <button
            className={ui.button}
            key={key}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => {
              if (tab !== key && canLeaveAdmin()) setTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "account" && <AccountPanel onLogout={onLogout} />}{" "}
      {tab === "branding" && <BrandingPanel />}
      {tab === "delivery" && <DeliveryPanel />}
      {tab === "security" && <SecurityPanel onLogout={onLogout} />}
    </div>
  );
}
function AccountPanel({ onLogout }: { onLogout: () => void }) {
  const [account, setAccount] = useState<Row | null>(null),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [email, setEmail] = useState(""),
    [emailPassword, setEmailPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useUnsavedChanges(
    Boolean(current || password || confirm || email || emailPassword),
  );
  useEffect(() => {
    void adminRequest("/account")
      .then(setAccount)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="efb-account-grid" data-admin-busy={busy}>
      <section className={ui.card + " space-y-4"}>
        <h2>Owner account</h2>
        <p className="efb-muted">
          Username: {String(account?.username ?? "Loading…")}. One trusted
          owner; no additional users are created.
        </p>
        <Feedback error={error} notice={notice} />
        {account && !account.storage_enabled && (
          <p className="efb-setup-notice">
            Account changes are disabled until the owner approves and applies
            optional Migration 007, runtime grants and ADMIN_UPGRADE_ENABLED.
            Existing sign-in remains available.
          </p>
        )}
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setNotice("");
            if (password !== confirm) {
              setError("New passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              await adminRequest("/account/password", "POST", {
                current_password: current,
                new_password: password,
              });
              setCurrent("");
              setPassword("");
              setConfirm("");
              onLogout();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            Current password
            <input
              className={ui.field}
              required
              type="password"
              autoComplete="current-password"
              maxLength={1024}
              value={current}
              disabled={busy || !account?.storage_enabled}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="block">
            New password
            <input
              className={ui.field}
              required
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              disabled={busy || !account?.storage_enabled}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="block">
            Confirm new password
            <input
              className={ui.field}
              required
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={confirm}
              disabled={busy || !account?.storage_enabled}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <p className="efb-muted">
            12–128 characters. Current password and CSRF verification are
            required. A successful change signs out every device, including this
            one.
          </p>
          <button
            className={ui.primary}
            disabled={busy || !account?.storage_enabled}
          >
            Change password & sign out
          </button>
        </form>
      </section>
      <section className={ui.card + " space-y-4"}>
        <h2>Verified recovery email</h2>
        <p className="efb-muted">
          {account?.verified_email
            ? "Verified: " + account.verified_email
            : "No recovery email is enrolled."}
        </p>
        <p className="efb-muted">
          {account?.email_delivery_ready
            ? "Email provider configured. A running approved worker is required to deliver verification and recovery links."
            : "Email delivery is not configured. No self-service recovery email can be sent."}
        </p>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const result = await adminRequest("/account/email", "POST", {
                current_password: emailPassword,
                email,
              });
              setEmailPassword("");
              setEmail("");
              setNotice(result.message);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block">
            New recovery email
            <input
              className={ui.field}
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={busy || !account?.email_delivery_ready}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            Confirm current password
            <input
              className={ui.field}
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              disabled={busy || !account?.email_delivery_ready}
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
            />
          </label>
          <button
            className={ui.primary}
            disabled={busy || !account?.email_delivery_ready}
          >
            Request email verification
          </button>
        </form>
        <p className="efb-muted">
          The existing verified address remains active until its replacement is
          verified. Links expire in 15 minutes and work once. Successful
          verification revokes all sessions.
        </p>
        <details>
          <summary>Locked out without working email?</summary>
          <p className="efb-muted mt-3">
            An authorized server operator can use the reviewed owner-recovery
            CLI after backing up, verifying the target and explicitly approving
            a credential reset. There is no browser bypass or public bootstrap
            password. See the Issue 29 operator runbook.
          </p>
        </details>
      </section>
    </div>
  );
}
function DeliveryPanel() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void adminRequest("/integrations")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className={ui.card + " space-y-5"}>
      <h2>Delivery integrations</h2>
      <Feedback error={error} />
      <p className="efb-muted">
        Credentials stay on the server. This screen reports configuration and
        queue states; it never exposes tokens or allows unreviewed
        provider/recipient changes.
      </p>
      {data && (
        <>
          <div className="efb-account-grid">
            <div className="efb-integration-card">
              <h3>WhatsApp Business Platform</h3>
              <strong>
                {data.whatsapp.configured
                  ? "Configured"
                  : "Disabled / not configured"}
              </strong>
              <p className="efb-muted">
                Worker:{" "}
                {data.whatsapp.worker_enabled
                  ? "enabled in configuration; verify the supervised process"
                  : "disabled"}
                . Automatic receipts require a Meta Business account, Cloud API
                phone-number ID/access token, a template approved for eight
                receipt body parameters, supported Graph version, explicit
                owner-recipient opt-in and an approved start time.
              </p>
              <p className="efb-muted">
                Customer details:{" "}
                {data.whatsapp.includes_customer_details
                  ? "enabled for the approved recipient"
                  : "excluded by default"}
                . Provider acceptance is not proof of device delivery. Ambiguous
                sends stop for operator review; no blind retry.
              </p>
            </div>
            <div className="efb-integration-card">
              <h3>Recovery email</h3>
              <strong>
                {data.email.configured
                  ? "Configured"
                  : "Disabled / not configured"}
              </strong>
              <p className="efb-muted">
                Adapter: {data.email.provider}. Requires a verified
                sender/domain with SPF/DKIM, server API key, approved HTTPS
                public origin and a running worker. SMTP requires a separately
                configured adapter; this build does not claim SMTP delivery.
              </p>
            </div>
          </div>
          <h3>Queue summary</h3>
          {data.queue.length ? (
            <ul className="space-y-2">
              {data.queue.map((q: any) => (
                <li
                  key={q.channel + q.state}
                  className="efb-count inline-block mr-2"
                >
                  {q.channel} · {q.state}: {q.total}
                </li>
              ))}
            </ul>
          ) : (
            <p className="efb-muted">
              No queued deliveries, or optional storage is disabled.
            </p>
          )}
          <p className="efb-muted">
            All persistent upgrade features require approved Migration 007 and
            runtime grants. Nothing is automatically migrated or deployed.
            Worker failures do not change booking success or existing lifecycle
            statuses.
          </p>
        </>
      )}
    </section>
  );
}
