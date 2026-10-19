import React, { useEffect, useState } from "react";
import { adminRequest, Feedback, ui } from "./ui";
type Point = { day: string; bookings: number };
type Period = "day" | "week" | "month" | "year";
export default function Analytics({
  statuses = [],
}: {
  statuses?: { status: string; total: number }[];
}) {
  const [period, setPeriod] = useState<Period>("day"),
    [points, setPoints] = useState<Point[]>([]),
    [label, setLabel] = useState("Last 30 calendar days"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let inFlight = false;
    async function load() {
      if (inFlight) return;
      inFlight = true;
      setBusy(true);
      try {
        const data = await adminRequest(
          "/analytics?period=" + period,
          "GET",
          undefined,
          abort.signal,
        );
        if (!abort.signal.aborted) {
          setPoints(data.points);
          setLabel(data.range_label);
          setError("");
        }
      } catch (e) {
        if (!abort.signal.aborted) setError((e as Error).message);
      } finally {
        inFlight = false;
        if (!abort.signal.aborted) setBusy(false);
      }
    }
    void load();
    const refresh = () => {
      if (!abort.signal.aborted) void load();
    };
    window.addEventListener("admin-data-updated", refresh);
    return () => {
      abort.abort();
      window.removeEventListener("admin-data-updated", refresh);
    };
  }, [period]);
  const max = Math.max(1, ...points.map((p) => p.bookings)),
    total = points.reduce((a, p) => a + p.bookings, 0),
    vertices = points.map((p, i) => ({
      ...p,
      x: points.length === 1 ? 50 : 8 + (i * 84) / (points.length - 1),
      y: 85 - (p.bookings / max) * 72,
    }));
  return (
    <section
      className={ui.card + " efb-analytics"}
      aria-label="Booking analytics"
      aria-busy={busy}
    >
      <div className="efb-section-heading">
        <div>
          <h2>Booking trends</h2>
          <p className="efb-muted">{label} · Asia/Dhaka</p>
        </div>
        <div className="efb-segmented" role="group" aria-label="Chart period">
          {(
            [
              ["day", "Daily"],
              ["week", "Weekly"],
              ["month", "Monthly"],
              ["year", "Yearly"],
            ] as const
          ).map(([id, name]) => (
            <button
              type="button"
              key={id}
              aria-pressed={period === id}
              onClick={() => setPeriod(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <Feedback error={error} />
      {busy && (
        <p className="efb-muted" role="status">
          Updating chart…
        </p>
      )}
      {!busy && !error && total === 0 ? (
        <div className="efb-empty">
          <h3>No bookings in this period</h3>
          <p>New requests will appear here after the next data refresh.</p>
        </div>
      ) : (
        points.length > 0 && (
          <>
            <div className="efb-chart">
              <span className="efb-chart-max">{max}</span>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Bookings by ${period}; ${total} in the displayed period. Exact values are in the table below.`}
              >
                {[13, 37, 61, 85].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    className="efb-chart-grid"
                  />
                ))}
                <polyline
                  className="efb-chart-line"
                  vectorEffect="non-scaling-stroke"
                  points={vertices.map((p) => p.x + "," + p.y).join(" ")}
                />
                {vertices.map((p) => (
                  <circle
                    key={p.day}
                    cx={p.x}
                    cy={p.y}
                    r=".8"
                    className="efb-chart-point"
                  >
                    <title>
                      {p.day}: {p.bookings} bookings
                    </title>
                  </circle>
                ))}
              </svg>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{points[0]?.day}</span>
                <span>{points.at(-1)?.day}</span>
              </div>
            </div>
            <details>
              <summary>View booking counts as a table</summary>
              <div className="efb-chart-table">
                <table>
                  <caption>
                    {label} · Bangladesh time. Weeks begin Monday; current
                    period may be incomplete.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Period starting</th>
                      <th scope="col">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.day}>
                        <th scope="row">{p.day}</th>
                        <td>{p.bookings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )
      )}
      {statuses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <span className="efb-count capitalize" key={s.status}>
              {s.status} <strong>{s.total}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
