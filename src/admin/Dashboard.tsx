import React from "react";
import {
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { ui, type Row } from "./ui";
import { StatusChip } from "./OperationsPanel";
import { bdDate } from "./operations-model";
import Analytics from "./Analytics";
export default function Dashboard({
  overview,
  bookings,
  onBookings,
  onMessages,
}: {
  overview: Row | null;
  bookings: Row[];
  onBookings: () => void;
  onMessages: () => void;
}) {
  const b = overview?.bookings as Row | undefined,
    c = overview?.contacts as Row | undefined;
  return (
    <div className="space-y-6">
      <div className="efb-kpi-grid">
        {[
          {
            label: "Today’s bookings",
            value: overview?.today_bookings,
            meta: "Since midnight · Bangladesh time",
            Icon: CalendarDays,
          },
          {
            label: "Total bookings",
            value: b?.total,
            meta: `${b?.pending ?? 0} pending requests`,
            Icon: ClipboardList,
          },
          {
            label: "Customer messages",
            value: c?.total,
            meta: `${c?.unread ?? 0} marked new`,
            Icon: MessageSquare,
          },
          {
            label: "Active services",
            value: overview?.services,
            meta: "Available service categories",
            Icon: Wrench,
          },
        ].map(({ label, value, meta, Icon }) => (
          <section className={ui.card + " efb-kpi"} key={label}>
            <div>
              <span>{label}</span>
              <Icon size={20} />
            </div>
            <strong>{String(value ?? "—")}</strong>
            <p>{meta}</p>
          </section>
        ))}
      </div>
      <div className="efb-overview-grid">
        <section className={ui.card}>
          <div className="efb-section-heading">
            <div>
              <h2>Recent bookings</h2>
              <p className="efb-muted">Latest customer service requests</p>
            </div>
            <button className={ui.button} onClick={onBookings}>
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="efb-recent-list">
            {bookings.slice(0, 5).map((b) => (
              <div key={String(b.booking_number)}>
                <span className="min-w-0">
                  <strong>{String(b.customer_name)}</strong>
                  <small>
                    {String(b.service_name)} · {String(b.booking_number)}
                  </small>
                  <time dateTime={String(b.created_at)}>
                    {bdDate(String(b.created_at))}
                  </time>
                </span>
                <StatusChip status={b.status} />
              </div>
            ))}
            {!bookings.length && (
              <p className="efb-muted">No bookings to display.</p>
            )}
          </div>
        </section>
        <section className={ui.card + " efb-follow-up"}>
          <p className="efb-eyebrow">Daily workspace</p>
          <h2>Keep follow-ups moving.</h2>
          <p className="efb-muted">
            Review pending requests, record private notes and track customer
            enquiries. Updates arrive every 20 seconds while this tab is active
            and you are not editing.
          </p>
          <button className={ui.primary} onClick={onMessages}>
            Open message center <ArrowRight size={16} />
          </button>
          <p className="efb-muted">
            Customer records stay in PostgreSQL. Booking receipts and reply
            tracking never imply a message was sent.
          </p>
        </section>
      </div>
      <Analytics
        statuses={
          overview?.statuses as { status: string; total: number }[] | undefined
        }
      />
    </div>
  );
}
