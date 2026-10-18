import React, { useEffect, useState } from "react";
import { adminRequest, Feedback, ui } from "./ui";
type Entry = {
  kind: string;
  id: string;
  source_id: string;
  action: string;
  reason: string;
  data: unknown;
  differences: { field: string; before: unknown; after: unknown }[];
};
type Preview = {
  target: { enabled: boolean; label: string };
  preview_digest: string;
  backup_digest: string;
  approval_token?: string;
  entries: Entry[];
  coverage: {
    complete: boolean;
    outstanding: string[];
    source_files: number;
    fields: number;
    documents: number;
    bindings: number;
    behavior: number;
    original_ai_studio_reconciled: boolean;
    collections: Record<string, number>;
  };
  totals: { imported: number; skipped: number; conflicted: number };
  catalog: { source_ref: string; notes: string[] };
};
function Values({ data }: { data: unknown }) {
  if (data === null || typeof data !== "object")
    return (
      <span className="whitespace-pre-wrap break-words">
        {String(data ?? "Empty")}
      </span>
    );
  return (
    <dl className="space-y-2 border-l border-[#DCE3E8] pl-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-semibold text-slate-500">
            {key.replaceAll("_", " ")}
          </dt>
          <dd className="text-sm">
            <Values data={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default function ContentImportPanel({
  onImported,
  blocked,
  onBusy,
}: {
  onImported: () => void;
  blocked: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [approved, setApproved] = useState(false),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [runs, setRuns] = useState<any[]>([]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const request = (path: string, method = "GET", body?: unknown) =>
    adminRequest("/full-content-import/" + path, method, body);
  async function loadRuns() {
    try {
      setRuns((await request("runs")).items);
    } catch {
      /* The preview will report unapplied migration 006; never fabricate a run. */
    }
  }
  useEffect(() => {
    void loadRuns();
  }, []);
  async function review(backup = false) {
    setBusy(true);
    setError("");
    setToken("");
    setApproved(false);
    try {
      const result = await request(backup ? "backup" : "preview");
      setPreview(result);
      if (backup) {
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(result, null, 2)], {
              type: "application/json",
            }),
          ),
          link = document.createElement("a");
        link.href = url;
        link.download = "electrofix-full-application-backup.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setToken(result.approval_token);
        setNotice(
          "Full application backup downloaded. Contains private records: retain securely. Approval expires in 15 minutes.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!approved || !token) return;
    setBusy(true);
    setError("");
    try {
      const result = await request("apply", "POST", {
        approval: "IMPORT COMPLETE PINNED CONTENT AS DRAFTS",
        approval_token: token,
        acknowledge_conflicts: true,
      });
      setNotice(
        `${result.imported.length} records imported as drafts, ${result.skipped.length} identical records skipped, ${result.conflicted.length} conflicts preserved. Run: ${result.run_id}. Nothing was published.`,
      );
      setToken("");
      setApproved(false);
      setPreview(null);
      await loadRuns();
      onImported();
    } catch (e) {
      setToken("");
      setApproved(false);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rollback(id: string) {
    if (
      !window.confirm(
        "Roll back this import only if no target has been edited or published since? New static records are archived; no customer records are deleted.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await request("runs/" + id + "/rollback", "POST", {
        approval: "ROLL BACK UNEDITED IMPORT DRAFTS",
      });
      setNotice("Import rollback confirmed. Saved versions remain in history.");
      await loadRuns();
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={ui.card + " mt-6 space-y-4"}
      aria-label="Existing content import"
    >
      <h2 className="text-lg font-bold">Import complete website content</h2>
      <p className="text-sm text-slate-500">
        Preview every source section and field, download a full database-content
        backup, then explicitly approve drafts. Existing edits, publications and
        customer records are preserved. Never run this against an unapproved
        database.
      </p>
      <Feedback error={error} notice={notice} />
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || blocked}
          className={ui.button}
          onClick={() => void review()}
        >
          Preview import
        </button>
        {preview && (
          <button
            disabled={busy || blocked}
            className={ui.button}
            onClick={() => void review(true)}
          >
            Download full backup for approval
          </button>
        )}
      </div>
      {preview && (
        <div className="space-y-4">
          <p className="text-sm font-semibold">
            Database target: {preview.target.label} ·{" "}
            {preview.target.enabled ? "Owner-enabled" : "Import disabled"}
          </p>
          <div className="rounded-md border border-[#DCE3E8] p-3 text-sm">
            <p>
              {preview.coverage.source_files} source files ·{" "}
              {preview.coverage.fields} mapped fields ·{" "}
              {preview.coverage.documents} component documents
            </p>
            <p>
              {Object.entries(preview.coverage.collections)
                .map(([k, n]) => n + " " + k)
                .join(" · ")}
            </p>
            <p>
              {preview.totals.imported} eligible · {preview.totals.skipped}{" "}
              identical · {preview.totals.conflicted} conflicts preserved
            </p>
            <p>
              {preview.coverage.behavior} code/design exclusions ·{" "}
              {preview.coverage.bindings} dynamic bindings
            </p>
            <p className="mt-2">Source: {preview.catalog.source_ref}</p>
          </div>
          {!preview.coverage.complete && (
            <div role="alert" className="text-sm text-red-700">
              Approval disabled: {preview.coverage.outstanding.join(", ")}
            </div>
          )}
          {!preview.coverage.original_ai_studio_reconciled && (
            <p className="text-sm text-amber-800">
              Pinned repository source is inventoried. Original independent AI
              Studio reconciliation and public CMS wiring still block production
              rollout.
            </p>
          )}
          {preview.entries.map((item) => (
            <details
              key={item.kind + item.id}
              className="rounded-md border border-[#DCE3E8] p-3"
            >
              <summary className="cursor-pointer break-words text-sm font-semibold">
                {item.kind} / {item.source_id} — {item.action}
              </summary>
              <p className="my-2 text-xs text-slate-500">{item.reason}</p>
              <details>
                <summary className="text-sm font-semibold">
                  Exact field differences ({item.differences.length})
                </summary>
                {item.differences.map((d, i) => (
                  <div key={i} className="mt-2 border-t border-[#DCE3E8] pt-2">
                    <strong className="break-words text-xs">{d.field}</strong>
                    <div className="mt-1 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">Current</p>
                        <Values data={d.before} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Source draft</p>
                        <Values data={d.after} />
                      </div>
                    </div>
                  </div>
                ))}
              </details>
              <details className="mt-2">
                <summary className="text-sm font-semibold">
                  Source values
                </summary>
                <Values data={item.data} />
              </details>
            </details>
          ))}
          <details>
            <summary className="text-sm font-semibold">
              Source mapping and limitations
            </summary>
            {preview.catalog.notes.map((n) => (
              <p key={n} className="mt-2 text-xs text-slate-500">
                {n}
              </p>
            ))}
            <a
              className="mt-3 block text-sm font-semibold text-[#004179]"
              href="/api/admin/full-content-import/inventory"
              target="_blank"
              rel="noreferrer"
            >
              View complete field inventory
            </a>
          </details>
          {token && (
            <div className="space-y-3">
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={
                    busy ||
                    blocked ||
                    !preview.coverage.complete ||
                    !preview.target.enabled
                  }
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                I retained the full backup, reviewed the counts/differences,
                approve this database target and draft import, and acknowledge
                that conflicts are preserved.
              </label>
              <button
                className={ui.primary}
                disabled={
                  busy ||
                  blocked ||
                  !approved ||
                  !preview.coverage.complete ||
                  !preview.totals.imported ||
                  !preview.target.enabled
                }
                onClick={() => void apply()}
              >
                Approve complete draft import
              </button>
            </div>
          )}
        </div>
      )}
      {runs.length > 0 && (
        <details>
          <summary className="text-sm font-semibold">
            Import runs and safe rollback
          </summary>
          {runs.map((run) => (
            <div
              key={run.id}
              className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#DCE3E8] pt-3"
            >
              <span className="break-all text-xs">
                {run.id} · {run.created_at}
                {run.rolled_back_at ? " · Rolled back" : ""}
              </span>
              <button
                className={ui.button}
                disabled={
                  busy ||
                  blocked ||
                  !preview?.target.enabled ||
                  Boolean(run.rolled_back_at)
                }
                onClick={() => void rollback(run.id)}
              >
                Roll back unedited drafts
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
