import React, { useMemo, useState } from "react";
import { ui } from "./ui";
type Point = { day: string; bookings: number };
type Period = "day" | "week" | "month" | "year";
const periods: { id: Period; label: string }[] = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
  { id: "year", label: "Yearly" },
];
function groupDays(days: Point[], period: Period): Point[] {
  const grouped = new Map<string, number>();
  for (const point of days) {
    // Dates supplied by the overview API are already grouped in Asia/Dhaka.
    const date = point.day.slice(0, 10);
    let key = date;
    if (period === "month") key = date.slice(0, 7);
    if (period === "year") key = date.slice(0, 4);
    if (period === "week") {
      const day = new Date(date + "T00:00:00Z");
      const offset = (day.getUTCDay() + 6) % 7;
      day.setUTCDate(day.getUTCDate() - offset);
      key = day.toISOString().slice(0, 10);
    }
    grouped.set(key, (grouped.get(key) ?? 0) + Number(point.bookings));
  }
  return Array.from(grouped, ([day, bookings]) => ({ day, bookings })).sort((a, b) => a.day.localeCompare(b.day));
}
export default function Analytics({
  days = [],
  statuses = [],
}: {
  days?: Point[];
  statuses?: { status: string; total: number }[];
}) {
  const [period, setPeriod] = useState<Period>("day");
  const points = useMemo(() => groupDays(days, period), [days, period]);
  const max = Math.max(1, ...points.map((point) => point.bookings));
  const vertices = points.map((point, i) => ({
    ...point,
    x: points.length === 1 ? 50 : 8 + i * 84 / (points.length - 1),
    y: 85 - point.bookings / max * 72,
  }));
  return (
    <section className={ui.card + " mt-6 space-y-5"} aria-label="Booking analytics">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Booking trends</h2>
          <p className="mt-1 text-xs text-slate-500">Last 30 days · Bangladesh time · totals by period</p>
        </div>
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Chart period">
          {periods.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={period === id}
              className={"rounded-lg px-3 py-2 text-xs font-semibold transition-colors " + (period === id ? "bg-white text-[#004179] shadow-sm" : "text-slate-500 hover:text-slate-800")}
              onClick={() => setPeriod(id)}>{label}</button>
          ))}
        </div>
      </div>
      {!points.length ? (
        <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No booking activity in this period.</p>
      ) : (
        <>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-5">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-52 w-full overflow-visible" role="img"
              aria-label={`Booking count trend: ${points.map(p => p.day + " " + p.bookings).join(", ")}`}>
              {[13, 37, 61, 85].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#dce3e8" strokeWidth=".3" strokeDasharray="1 1" />)}
              <polyline fill="none" stroke="#004179" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke" points={vertices.map(p => p.x + "," + p.y).join(" ")} />
              {vertices.map(p => <circle key={p.day} cx={p.x} cy={p.y} r="1.2" stroke="white" strokeWidth=".5" fill="#004179">
                <title>{p.day}: {p.bookings} bookings</title>
              </circle>)}
            </svg>
            <div className="mt-3 flex justify-between text-[11px] text-slate-500"><span>{points[0]?.day}</span><span>{points[points.length - 1]?.day}</span></div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-[#004179] font-semibold">View booking counts as a table</summary>
            <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm"><thead><tr><th className="p-3">Period starting</th><th className="p-3">Bookings</th></tr></thead>
                <tbody>{points.map(point => <tr key={point.day} className="border-t border-slate-100"><td className="p-3">{point.day}</td><td className="p-3 tabular-nums">{point.bookings}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
      {statuses.length > 0 && <div className="flex flex-wrap gap-2">{statuses.map(s => (
        <span key={s.status} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
          <span className="capitalize">{s.status}</span> <strong>{s.total}</strong>
        </span>
      ))}</div>}
    </section>
  );
}
