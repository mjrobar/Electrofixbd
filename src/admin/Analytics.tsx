import React from "react";
import { ui } from "./ui";
export default function Analytics({
  days = [],
  statuses = [],
}: {
  days?: { day: string; bookings: number }[];
  statuses?: { status: string; total: number }[];
}) {
  return (
    <section className={ui.card + " mt-6 space-y-4"}>
      <h2 className="text-lg font-bold">Booking activity · last 30 days</h2>
      <div className="flex flex-wrap gap-4">
        {statuses.map((s) => (
          <p key={s.status} className="text-sm">
            <span className="capitalize text-slate-500">{s.status}</span>{" "}
            <strong>{s.total}</strong>
          </p>
        ))}
      </div>
      {!days.length ? (
        <p className="text-sm text-slate-500">
          No booking activity in this period.
        </p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left text-xs text-slate-500">
              Booking dates use Bangladesh time; days with no bookings are
              omitted.
            </caption>
            <thead>
              <tr>
                <th className="py-2">Date</th>
                <th>Requests</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-[#DCE3E8]">
                  <td className="py-2">
                    {new Date(d.day).toLocaleDateString()}
                  </td>
                  <td>{d.bookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
