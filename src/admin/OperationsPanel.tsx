import React, { useEffect, useState } from "react";
import {
  canLeaveAdmin,
  useUnsavedChanges,
  adminRequest,
  Feedback,
  ui,
  type Row,
} from "./ui";
const nextStatuses: Record<string, string[]> = {
  pending: ["contacted", "confirmed", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: ["confirmed"],
  cancelled: ["pending"],
};
export default function OperationsPanel({
  kind,
}: {
  kind: "bookings" | "contacts";
}) {
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [items, setItems] = useState<Row[]>([]),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loaded, setLoaded] = useState(false);
  const statuses =
    kind === "bookings"
      ? Object.keys(nextStatuses)
      : ["new", "read", "replied"];
  async function load(start = offset) {
    if (!canLeaveAdmin()) return;
    setBusy(true);
    setLoaded(false);
    setError("");
    try {
      const result = await adminRequest(
        `/${kind}?q=${encodeURIComponent(q)}&status=${status}&offset=${start}`,
      );
      setItems(result.items);
      setAppliedStatus(status);
      setTotal(result.total);
      setOffset(start);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load(0);
  }, []);
  async function save(item: Row, change: Row) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const id = String(item.booking_number ?? item.id);
      const result = await adminRequest(
        `/${kind}/${encodeURIComponent(id)}`,
        "PATCH",
        { revision: item.revision, ...change },
      );
      setItems((prev) =>
        prev.map((row) =>
          (row.booking_number ?? row.id) === id ? result.item : row,
        ),
      );
      if (appliedStatus !== "all" && result.item.status !== appliedStatus) {
        setItems((prev) =>
          prev.filter((row) => (row.booking_number ?? row.id) !== id),
        );
        setTotal((value) => Math.max(0, value - 1));
      }
      setNotice("Saved to PostgreSQL.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={ui.card + " space-y-4"}>
      <h2 className="text-lg font-bold">
        {kind === "bookings" ? "Manage bookings" : "Customer inbox"}
      </h2>
      <Feedback error={error} notice={notice} />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load(0);
        }}
      >
        <label className="min-w-0 basis-full text-sm font-semibold sm:flex-1 sm:basis-0">
          Search {kind}
          <input
            maxLength={100}
            className={ui.field}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Status
          <select
            value={status}
            className={ui.field}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["all", ...statuses].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button disabled={busy} className={ui.button}>
          Search / reload
        </button>
      </form>
      {busy && <p role="status">Working…</p>}
      {loaded && !items.length && (
        <p className="text-sm text-slate-500">No matching requests.</p>
      )}
      {loaded &&
        items.map((item) => (
          <article
            className="space-y-3 border-t border-[#DCE3E8] pt-4"
            key={String(item.booking_number ?? item.id)}
          >
            <h3 className="break-words font-bold">
              {String(item.customer_name ?? item.name)}
            </h3>
            <p className="break-words text-sm text-slate-500">
              {String(item.booking_number ?? "")} ·{" "}
              {new Date(String(item.created_at)).toLocaleString()} ·{" "}
              {String(item.status)}
            </p>
            <p className="text-sm">{String(item.service_name ?? "")}</p>
            <p className="break-words text-sm">
              <a href={"tel:" + String(item.phone).replace(/[^+\d]/g, "")}>
                {String(item.phone)}
              </a>
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {String(item.address ?? item.message)}
            </p>
            {Boolean(item.notes) && (
              <p className="whitespace-pre-wrap break-words text-sm">
                Customer note: {String(item.notes)}
              </p>
            )}
            <label className="block text-sm font-semibold">
              {kind === "bookings" ? "Booking status" : "Message status"}
              <select
                className={ui.field + " max-w-sm"}
                disabled={busy}
                value={String(item.status)}
                onChange={(e) => {
                  if (canLeaveAdmin())
                    void save(item, { status: e.target.value });
                }}
              >
                {[
                  String(item.status),
                  ...(kind === "bookings"
                    ? nextStatuses[String(item.status)] || []
                    : statuses.filter((s) => s !== item.status)),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <Notes
              key={String(item.revision)}
              value={String(item.admin_notes ?? "")}
              disabled={busy}
              onSave={(notes) => void save(item, { admin_notes: notes })}
            />
          </article>
        ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy || offset === 0}
          className={ui.button}
          onClick={() => void load(Math.max(0, offset - 30))}
        >
          Previous
        </button>
        <span className="text-sm">
          {Math.min(offset + 1, total)}–{Math.min(offset + 30, total)} of{" "}
          {total}
        </span>
        <button
          disabled={busy || offset + 30 >= total}
          className={ui.button}
          onClick={() => void load(offset + 30)}
        >
          Next
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Internal notes are private. Changes require the revision you loaded;
        reload after conflicts. Completed or cancelled bookings can be reopened
        through their next status.
      </p>
    </section>
  );
}
function Notes({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [notes, setNotes] = useState(value);
  useUnsavedChanges(notes !== value);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(notes);
      }}
    >
      <label className="block text-sm font-semibold">
        Internal notes
        <textarea
          maxLength={5000}
          rows={3}
          className={ui.field}
          disabled={disabled}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button disabled={disabled || notes === value} className={ui.button}>
        Save internal notes
      </button>
    </form>
  );
}
