import React, { useEffect, useState } from "react";
import { adminRequest, Feedback, ui, type Row } from "./ui";
import { bdDate } from "./operations-model";
export default function SecurityPanel({ onLogout }: { onLogout: () => void }) {
  const [sessions, setSessions] = useState<Row[]>([]),
    [audit, setAudit] = useState<Row[]>([]),
    [hardened, setHardened] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [s, a, r] = await Promise.all([
        adminRequest("/sessions"),
        adminRequest("/audit"),
        adminRequest("/security/readiness"),
      ]);
      setHardened(r.database_hardened);
      setSessions(s.items);
      setAudit(a.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function revoke() {
    if (
      !window.confirm("Revoke every administrator session, including this one?")
    )
      return;
    setBusy(true);
    try {
      await adminRequest("/logout-all", "POST", {});
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <section className={ui.card + " space-y-4"}>
        <h2 className="text-lg font-bold">Admin security</h2>
        <p className="text-sm text-slate-500">
          One trusted owner account is maintained on the server. Sessions expire
          after 30 minutes idle or 8 hours maximum. Credential or session-secret
          rotation invalidates existing sessions.
        </p>
        <p role="status" className="text-sm">
          Database hardening:{" "}
          {hardened
            ? "restricted runtime and browser access checks passed"
            : "not verified; approved lockdown and a restricted runtime connection are required before production"}
          .
        </p>
        <Feedback error={error} />
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => void load()}
            className={ui.button}
          >
            Refresh security
          </button>
          <button
            disabled={busy}
            onClick={() => void revoke()}
            className={ui.button}
          >
            Revoke all sessions
          </button>
        </div>
        <h3 className="font-semibold">Active sessions ({sessions.length})</h3>
        {sessions.map((s, i) => (
          <p key={i} className="text-sm">
            {s.current ? "This session" : "Other session"} · Last active{" "}
            {bdDate(String(s.last_seen_at))} · Expires{" "}
            {bdDate(String(s.expires_at))} · BDT
          </p>
        ))}
      </section>
      <section className={ui.card + " space-y-3"}>
        <h2 className="text-lg font-bold">Recent change log</h2>
        <p className="text-sm text-slate-500">
          Record identifiers and revisions only. Customer messages, addresses,
          phone numbers and internal notes are excluded from this log.
        </p>
        {audit.map((item, index) => (
          <p
            key={index}
            className="break-words border-t border-[#DCE3E8] pt-3 text-sm"
          >
            {String(item.entity).replaceAll("_", " ")} · {String(item.action)} ·
            Revision {String(item.revision)} · {bdDate(String(item.created_at))}{" "}
            · BDT
          </p>
        ))}
        {!audit.length && (
          <p className="text-sm text-slate-500">No changes recorded yet.</p>
        )}
      </section>
    </div>
  );
}
