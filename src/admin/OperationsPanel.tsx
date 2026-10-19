import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ClipboardList,
  Copy,
  Inbox,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  adminRequest,
  copyAdminText,
  canLeaveAdmin,
  Feedback,
  ui,
  useUnsavedChanges,
  type Row,
  adminInteractionActive,
} from "./ui";
import {
  bookingNextStatuses,
  bdDate,
  contactPhone,
  statusLabel,
} from "./operations-model";
import AdminDialog from "./AdminDialog";
const identity = (item: Row) => String(item.booking_number ?? item.id);
export function StatusChip({ status }: { status: unknown }) {
  return (
    <span className={"efb-status efb-status-" + String(status)}>
      {statusLabel(status)}
    </span>
  );
}
export default function OperationsPanel({
  kind,
}: {
  kind: "bookings" | "contacts";
}) {
  const [items, setItems] = useState<Row[]>([]),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("all"),
    [applied, setApplied] = useState({ q: "", status: "all" }),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0),
    [sort, setSort] = useState("newest"),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [updated, setUpdated] = useState("");
  const inFlight = useRef(false),
    generation = useRef(0),
    latest = useRef<() => void>(() => {}),
    controller = useRef<AbortController | null>(null);
  const statuses =
    kind === "bookings"
      ? Object.keys(bookingNextStatuses)
      : ["new", "read", "replied"];
  async function load(start = offset, query = applied, silent = false) {
    if (inFlight.current) return;
    if (!silent && !canLeaveAdmin()) return;
    inFlight.current = true;
    const id = ++generation.current,
      abort = new AbortController();
    controller.current = abort;
    if (!silent) {
      setBusy(true);
      setError("");
    }
    try {
      const result = await adminRequest(
        `/${kind}?q=${encodeURIComponent(query.q)}&status=${query.status}&offset=${start}`,
        "GET",
        undefined,
        abort.signal,
      );
      if (abort.signal.aborted || id !== generation.current) return;
      if (start > 0 && !result.items.length && result.total > 0) {
        setNotice(
          "This page is empty after changes. Use Previous to view remaining results.",
        );
      }
      setItems(result.items);
      setTotal(result.total);
      setOffset(start);
      setApplied(query);
      setLoaded(true);
      setUpdated(bdDate(new Date().toISOString()));
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  latest.current = () => {
    if (!selected && !busy && !adminInteractionActive())
      void load(offset, applied, true);
  };
  useEffect(() => {
    void load(0, { q: "", status: "all" });
    const changed = () => latest.current();
    window.addEventListener("admin-data-updated", changed);
    return () => {
      controller.current?.abort();
      generation.current++;
      window.removeEventListener("admin-data-updated", changed);
    };
  }, [kind]);
  async function save(item: Row, change: Row) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const id = identity(item),
        result = await adminRequest(
          `/${kind}/${encodeURIComponent(id)}`,
          "PATCH",
          { revision: item.revision, ...change },
        );
      setSelected(result.item);
      setItems((prev) =>
        prev
          .map((row) => (identity(row) === id ? result.item : row))
          .filter(
            (row) => applied.status === "all" || row.status === applied.status,
          ),
      );
      if (applied.status !== "all" && result.item.status !== applied.status)
        setTotal((v) => Math.max(0, v - 1));
      setNotice(
        kind === "contacts" && change.status === "replied"
          ? "Marked as replied for tracking. No reply was sent."
          : "Changes saved.",
      );
      window.dispatchEvent(new Event("admin-operation-saved"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sorted = [...items].sort((a, b) =>
    sort === "name"
      ? String(a.customer_name ?? a.name).localeCompare(
          String(b.customer_name ?? b.name),
        )
      : sort === "oldest"
        ? String(a.created_at).localeCompare(String(b.created_at))
        : String(b.created_at).localeCompare(String(a.created_at)),
  );
  return (
    <section
      className={ui.card + " efb-operations"}
      aria-label={
        kind === "bookings" ? "Booking management" : "Customer messages"
      }
      data-admin-busy={busy}
      data-admin-editing={q !== applied.q || status !== applied.status}
    >
      <div className="efb-section-heading">
        <div className="flex items-center gap-3">
          <span className="efb-section-icon">
            {kind === "bookings" ? (
              <ClipboardList size={22} />
            ) : (
              <Inbox size={22} />
            )}
          </span>
          <div>
            <h2>
              {kind === "bookings" ? "Booking management" : "Message center"}
            </h2>
            <p className="efb-muted">
              {kind === "bookings"
                ? "Service requests, from first contact to completion."
                : "Customer enquiries and private follow-up notes."}
            </p>
          </div>
        </div>
        <span className="efb-count">{total} results</span>
      </div>
      <Feedback error={error} notice={notice} />
      <form
        className="efb-operation-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load(0, { q, status });
        }}
      >
        <label>
          Search {kind === "bookings" ? "bookings" : "messages"}
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-4 text-slate-400"
            />
            <input
              className={ui.field + " pl-10"}
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                kind === "bookings"
                  ? "Name, phone, booking or service"
                  : "Name, phone or message"
              }
            />
          </div>
        </label>
        <label>
          Filter by status
          <select
            className={ui.field}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["all", ...statuses].map((s) => (
              <option value={s} key={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className={ui.primary}>
          Apply filters
        </button>
        <button
          type="button"
          className={ui.button}
          disabled={busy}
          onClick={() => void load(offset)}
        >
          <RefreshCw size={16} /> Refresh list
        </button>
      </form>
      {(q !== applied.q || status !== applied.status) && (
        <p className="efb-muted">
          Filter changes are pending. Choose Apply filters to update the
          results.
        </p>
      )}
      <div className="efb-list-meta">
        <p role="status">
          {busy
            ? "Updating…"
            : updated
              ? "Updated " + updated + " · BDT"
              : "Loading requests…"}
        </p>
        <label className="flex items-center gap-2">
          <ArrowDownUp size={15} /> Sort this page
          <select
            className={ui.field}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Customer name</option>
          </select>
        </label>
      </div>
      {loaded && !items.length ? (
        <div className="efb-empty">
          <Inbox size={30} />
          <h3>No matching requests</h3>
          <p>Try another search or status filter.</p>
        </div>
      ) : (
        <div className="efb-request-list">
          <div className="efb-request-head" aria-hidden="true">
            <span>Customer / request</span>
            <span>{kind === "bookings" ? "Service" : "Message"}</span>
            <span>Status</span>
            <span>Received · BDT</span>
          </div>
          {sorted.map((item) => (
            <button
              type="button"
              key={identity(item)}
              className="efb-request-row"
              onClick={() => setSelected(item)}
              aria-label={
                "Open " +
                (kind === "bookings"
                  ? String(item.booking_number)
                  : "message from " + String(item.name))
              }
            >
              <span className="min-w-0">
                <strong>{String(item.customer_name ?? item.name)}</strong>
                <small>
                  {kind === "bookings"
                    ? String(item.booking_number)
                    : String(item.phone)}
                </small>
              </span>
              <span className="efb-request-summary">
                {String(item.service_name ?? item.message)}
              </span>
              <StatusChip status={item.status} />
              <time dateTime={String(item.created_at)}>
                {bdDate(String(item.created_at))}
              </time>
            </button>
          ))}
        </div>
      )}
      <div className="efb-pagination">
        <p>
          {total ? offset + 1 : 0}–{Math.min(offset + items.length, total)} of{" "}
          {total}
        </p>
        <div className="flex gap-2">
          <button
            disabled={busy || offset === 0}
            className={ui.button}
            onClick={() => void load(Math.max(0, offset - 30))}
          >
            Previous
          </button>
          <button
            disabled={busy || offset + 30 >= total}
            className={ui.button}
            onClick={() => void load(offset + 30)}
          >
            Next
          </button>
        </div>
      </div>
      {selected && (
        <AdminDialog
          title={kind === "bookings" ? "Booking details" : "Message details"}
          onClose={() => {
            if (!busy && canLeaveAdmin()) setSelected(null);
          }}
        >
          <Feedback error={error} notice={notice} />
          <div className="efb-detail-title">
            <div>
              <p className="efb-eyebrow">
                {kind === "bookings" ? identity(selected) : "Customer enquiry"}
              </p>
              <h3>{String(selected.customer_name ?? selected.name)}</h3>
            </div>
            <StatusChip status={selected.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {contactPhone(selected.phone) && (
              <a
                className={ui.button + " inline-flex items-center gap-2"}
                href={"tel:" + contactPhone(selected.phone)}
              >
                <Phone size={16} />
                {String(selected.phone)}
              </a>
            )}
            <button
              className={ui.button}
              onClick={() => {
                void copyAdminText(
                  kind === "bookings"
                    ? identity(selected)
                    : String(selected.phone),
                )
                  .then(() => setNotice("Copied to clipboard."))
                  .catch(() =>
                    setError(
                      "Clipboard unavailable. Select and copy the text instead.",
                    ),
                  );
              }}
            >
              <Copy size={16} />
              Copy {kind === "bookings" ? "booking number" : "phone"}
            </button>
          </div>
          <dl className="efb-detail-fields">
            <div>
              <dt>Received · Bangladesh time</dt>
              <dd>{bdDate(String(selected.created_at))}</dd>
            </div>
            {kind === "bookings" && (
              <>
                <div>
                  <dt>Service</dt>
                  <dd>{String(selected.service_name)}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{String(selected.address)}</dd>
                </div>
                {Boolean(selected.notes) && (
                  <div>
                    <dt>Customer note</dt>
                    <dd>{String(selected.notes)}</dd>
                  </div>
                )}
              </>
            )}
            {kind === "contacts" && (
              <div className="efb-message-body">
                <dt>Original customer message</dt>
                <dd>{String(selected.message)}</dd>
              </div>
            )}
          </dl>
          <StatusForm
            key={identity(selected) + ":" + selected.revision}
            item={selected}
            statuses={
              kind === "bookings"
                ? [
                    String(selected.status),
                    ...(bookingNextStatuses[String(selected.status)] || []),
                  ]
                : statuses
            }
            busy={busy}
            onSave={(change) => void save(selected, change)}
          />
          {kind === "bookings" && <ManualReceipt number={identity(selected)} />}
          {kind === "contacts" && (
            <p className="efb-muted">
              Read / replied are tracking statuses. This workspace does not send
              a reply or create a conversation thread.
            </p>
          )}
        </AdminDialog>
      )}
    </section>
  );
}
function StatusForm({
  item,
  statuses,
  busy,
  onSave,
}: {
  item: Row;
  statuses: string[];
  busy: boolean;
  onSave: (change: Row) => void;
}) {
  const [status, setStatus] = useState(String(item.status)),
    [notes, setNotes] = useState(String(item.admin_notes ?? ""));
  const dirty =
    status !== item.status || notes !== String(item.admin_notes ?? "");
  useUnsavedChanges(dirty);
  return (
    <form
      className="efb-detail-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...(status !== item.status ? { status } : {}),
          ...(notes !== String(item.admin_notes ?? "")
            ? { admin_notes: notes }
            : {}),
        });
      }}
    >
      <h3>Update request</h3>
      <label>
        Status
        <select
          aria-label="Status"
          className={ui.field}
          value={status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value)}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Internal notes
        <textarea
          className={ui.field}
          maxLength={5000}
          rows={4}
          value={notes}
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <p className="efb-muted">
        Private to the owner. Only existing workflow transitions are available.
        Reload after a revision conflict.
      </p>
      <button className={ui.primary} disabled={busy || !dirty}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
function ManualReceipt({ number }: { number: string }) {
  const [text, setText] = useState(""),
    [details, setDetails] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <section className="efb-receipt">
      <h3 className="flex items-center gap-2">
        <MessageCircle size={18} /> WhatsApp receipt · manual
      </h3>
      <p className="efb-muted">
        Preview a receipt, then choose the recipient and press Send in WhatsApp.
        Automatic delivery is a separate, approved Business API integration.
      </p>
      <label className="efb-checkbox">
        <input
          type="checkbox"
          checked={details}
          onChange={(e) => {
            setDetails(e.target.checked);
            setText("");
          }}
        />
        Include customer name, phone, address and customer note. Share only with
        an authorized recipient.
      </label>
      <button
        className={ui.button}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setText(
              (
                await adminRequest(
                  `/booking-receipts/${number}?details=${details}`,
                )
              ).text,
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing…" : "Preview manual receipt"}
      </button>
      <Feedback error={error} notice={notice} />
      {text && (
        <>
          <pre className="efb-receipt-preview">{text}</pre>
          <div className="flex flex-wrap gap-2">
            <button
              className={ui.button}
              onClick={() => {
                void copyAdminText(text)
                  .then(() =>
                    setNotice("Receipt copied. Review before sharing."),
                  )
                  .catch(() =>
                    setError(
                      "Clipboard unavailable. Select the receipt text and copy it.",
                    ),
                  );
              }}
            >
              Copy receipt
            </button>
            <button
              className={ui.primary}
              disabled={text.length > 4000}
              onClick={() =>
                window.open(
                  "https://wa.me/?text=" + encodeURIComponent(text),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Open WhatsApp manually
            </button>
          </div>
          {text.length > 4000 && (
            <p className="efb-muted">
              This receipt is too long for a reliable deep link. Copy and paste
              it manually.
            </p>
          )}
        </>
      )}
    </section>
  );
}
