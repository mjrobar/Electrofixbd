import React, { useEffect, useState } from "react";
export type Row = Record<string, unknown>;
export const ui = {
  card: "rounded-lg border border-[#DCE3E8] bg-white p-5 sm:p-6",
  button:
    "rounded-md border border-[#DCE3E8] bg-white px-4 py-2.5 text-sm font-semibold text-[#004179] disabled:opacity-50",
  primary:
    "rounded-md bg-[#004179] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50",
  field:
    "mt-1 block min-h-11 w-full rounded-md border border-[#DCE3E8] bg-white px-3 py-2 text-sm",
};
export async function adminRequest(
  path: string,
  method = "GET",
  data?: unknown,
) {
  const response = await fetch("/api/admin" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(method !== "GET"
        ? { "X-Admin-Request": "1", "Content-Type": "application/json" }
        : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401)
    window.dispatchEvent(new Event("admin-session-expired"));
  if (!response.ok)
    throw Error(body.error || "Request failed. Reload and retry.");
  return body;
}
export function Feedback({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
    </>
  );
}
export function Preview({ data }: { data: Row }) {
  return (
    <dl className="space-y-3 break-words">
      {Object.entries(data)
        .filter(
          ([key, value]) =>
            ![
              "admin_draft",
              "revision",
              "archived_at",
              "created_at",
              "updated_at",
              "submission_digest",
              "submission_key",
            ].includes(key) &&
            value !== null &&
            value !== "",
        )
        .map(([key, value]) => (
          <div key={key}>
            <dt className="text-xs font-semibold capitalize text-slate-500">
              {key.replaceAll("_", " ")}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">
              {Array.isArray(value) ? value.join("\n") : String(value)}
              {["cover_image", "media_url", "avatar_url"].includes(key) &&
                typeof value === "string" &&
                /^\/api\/media\/[a-f0-9-]{36}$/.test(value) && (
                  <img
                    src={"/api/admin/media/" + value.split("/").pop() + "/blob"}
                    alt="Uploaded image"
                    className="mt-2 max-h-48 max-w-full rounded border border-[#DCE3E8]"
                  />
                )}
            </dd>
          </div>
        ))}
    </dl>
  );
}
export function HistoryPanel({
  entity,
  id,
  revision,
  onRestore,
  disabled = false,
}: {
  entity: string;
  id: string;
  revision: number;
  onRestore: () => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<
      { revision: number; snapshot: Row; saved_at: string }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    setItems([]);
    setOpen(false);
    setError("");
  }, [entity, id, revision]);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setItems(
        (await adminRequest(`/history/${entity}/${encodeURIComponent(id)}`))
          .items,
      );
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(source_revision: number) {
    if (
      !window.confirm(
        "Restore this saved version as a draft? Current publication will stay in place until you publish.",
      )
    )
      return;
    setBusy(true);
    try {
      await adminRequest(
        `/history/${entity}/${encodeURIComponent(id)}/restore`,
        "POST",
        { revision, source_revision },
      );
      onRestore();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => void load()}
        className={ui.button}
      >
        Version history
      </button>
      <Feedback error={error} />
      {open && (
        <div className="space-y-3">
          {!items.length && (
            <p className="text-sm text-slate-500">
              No earlier saved versions yet.
            </p>
          )}
          {items.map((item) => (
            <details
              key={item.revision}
              className="rounded-md border border-[#DCE3E8] p-3"
            >
              <summary className="text-sm font-semibold">
                Revision {item.revision} ·{" "}
                {new Date(item.saved_at).toLocaleString()}
              </summary>
              <div className="my-3 max-h-80 overflow-auto">
                <Preview
                  data={(item.snapshot.admin_draft as Row) ?? item.snapshot}
                />
              </div>
              <button
                type="button"
                className={ui.button}
                disabled={busy || disabled}
                onClick={() => void restore(item.revision)}
              >
                Restore as draft
              </button>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

const pendingEdits = new Set<string>();
export function canLeaveAdmin() {
  return (
    pendingEdits.size === 0 ||
    window.confirm("Discard unsaved admin edits before leaving this view?")
  );
}
export function useUnsavedChanges(dirty: boolean) {
  const id = React.useId();
  useEffect(() => {
    if (dirty) pendingEdits.add(id);
    else pendingEdits.delete(id);
    return () => {
      pendingEdits.delete(id);
    };
  }, [dirty, id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
