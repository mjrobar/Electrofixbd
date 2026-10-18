import React, { useEffect, useState } from "react";
import SiteControlsEditor from "./SiteControlsEditor";
import { SERVICES_DATA } from "../data/servicesData";
import {
  useUnsavedChanges,
  adminRequest,
  Feedback,
  HistoryPanel,
  Preview,
  ui,
  type Row,
} from "./ui";
type Kind = "services" | "works" | "testimonials";
type RecordValue = Row;
const fields: Record<
  Kind,
  {
    key: string;
    label: string;
    type?: "textarea" | "list" | "boolean" | "number" | "select";
    required?: boolean;
  }[]
> = {
  services: [
    { key: "slug", label: "URL slug", required: true },
    { key: "name", label: "Service title", required: true },
    {
      key: "short_description",
      label: "Short description",
      type: "textarea",
      required: true,
    },
    {
      key: "full_description",
      label: "Full description",
      type: "textarea",
      required: true,
    },
    {
      key: "common_problems",
      label: "Common problems (one per line)",
      type: "list",
    },
    {
      key: "service_process",
      label: "Service process (one per line)",
      type: "list",
    },
    { key: "cover_image", label: "Cover image URL" },
    { key: "is_active", label: "Active", type: "boolean" },
  ],
  works: [
    { key: "title", label: "Project title", required: true },
    { key: "slug", label: "URL slug", required: true },
    { key: "service_type", label: "Service type", required: true },
    { key: "category", label: "Category", required: true },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      required: true,
    },
    { key: "media_url", label: "Image or video URL", required: true },
    { key: "media_type", label: "Media type", type: "select" },
    { key: "is_featured", label: "Featured", type: "boolean" },
    { key: "is_published", label: "Published", type: "boolean" },
  ],
  testimonials: [
    { key: "customer_name", label: "Customer name", required: true },
    { key: "review", label: "Review", type: "textarea", required: true },
    { key: "service_type", label: "Service type", required: true },
    { key: "rating", label: "Rating (1–5)", type: "number" },
    { key: "avatar_url", label: "Avatar URL" },
    { key: "media_url", label: "Optional image/video URL" },
    { key: "media_type", label: "Media type", type: "select" },
    { key: "is_published", label: "Published", type: "boolean" },
  ],
};
const empty: Record<Kind, RecordValue> = {
  services: {
    slug: "",
    name: "",
    short_description: "",
    full_description: "",
    common_problems: [],
    service_process: [],
    cover_image: "",
    is_active: false,
  },
  works: {
    title: "",
    slug: "",
    service_type: "",
    category: "",
    description: "",
    media_url: "",
    media_type: "image",
    is_featured: false,
    is_published: false,
  },
  testimonials: {
    customer_name: "",
    review: "",
    service_type: "",
    rating: 5,
    avatar_url: "",
    media_url: "",
    media_type: null,
    is_published: false,
  },
};
export default function ContentEditor() {
  const [kind, setKind] = useState<Kind>("services"),
    [generation, setGeneration] = useState(0),
    [dirty, setDirty] = useState(false);
  return (
    <div className="space-y-5">
      <div className={ui.card}>
        <h2 className="text-xl font-bold">Website Content Studio</h2>
        <p className="mt-1 text-sm text-slate-500">
          Save drafts, preview and publish approved content. Media uses public
          HTTPS URLs; files are not uploaded here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["services", "works", "testimonials"] as const).map((k) => (
            <button
              key={k}
              className={kind === k ? ui.primary : ui.button}
              onClick={() => {
                if (
                  k !== kind &&
                  (!dirty || window.confirm("Discard unsaved edits?"))
                ) {
                  setDirty(false);
                  setKind(k);
                  setGeneration((v) => v + 1);
                }
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <ContentModule key={kind + generation} kind={kind} onDirty={setDirty} />
      <SiteControlsEditor />
    </div>
  );
}
function ContentModule({
  kind,
  onDirty,
}: {
  kind: Kind;
  onDirty: (value: boolean) => void;
}) {
  const [items, setItems] = useState<Row[]>([]),
    [editing, setEditing] = useState<Row | null>(null),
    [preview, setPreview] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("all"),
    [offset, setOffset] = useState(0),
    [total, setTotal] = useState(0);
  useUnsavedChanges(editing !== null);
  const endpoint = "/content/" + kind;
  useEffect(() => {
    onDirty(editing !== null);
    return () => onDirty(false);
  }, [editing, onDirty]);
  async function load(start = offset, status = filter, query = q) {
    setBusy(true);
    setError("");
    setLoaded(false);
    try {
      const result = await adminRequest(
        `${endpoint}?q=${encodeURIComponent(query)}&status=${status}&offset=${start}`,
      );
      setItems(result.items);
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
  function edit(item: Row) {
    const data = (item.admin_draft as Row) ?? item;
    // Legacy test rows are incomplete. The public site currently hydrates
    // missing fields from the approved static service catalogue. Show the
    // same fallback while editing; saving a draft persists only on approval.
    const original = kind === "services"
      ? SERVICES_DATA.find((service) => service.slug === data.slug)
      : undefined;
    const fieldsFromOriginal = original ? {
      short_description: original.shortDescription,
      full_description: original.fullDescription,
      common_problems: original.commonProblems,
      service_process: original.serviceProcess,
      cover_image: original.coverImage,
    } : null;
    const hydrated = { ...item, ...data };
    if (fieldsFromOriginal && !item.admin_draft) {
      for (const [key, value] of Object.entries(fieldsFromOriginal)) {
        const current = hydrated[key];
        if (current == null || current === "" ||
            (Array.isArray(current) && current.length === 0)) {
          hydrated[key] = value;
        }
      }
    }
    setEditing(hydrated);
    setPreview(false);
    setNotice("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = Object.fromEntries(
        fields[kind].map((f) => [
          f.key,
          f.type === "list" && typeof editing[f.key] === "string"
            ? (editing[f.key] as string)
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean)
            : (editing[f.key] ?? empty[kind][f.key]),
        ]),
      );
      const result = await adminRequest(
        endpoint +
          (editing.id ? "/" + encodeURIComponent(String(editing.id)) : ""),
        editing.id ? "PUT" : "POST",
        { ...data, ...(editing.id ? { revision: editing.revision } : {}) },
      );
      setEditing(null);
      setNotice(
        `Draft saved at revision ${result.item.revision}. Publication is unchanged.`,
      );
      await load(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(item: Row, action: string) {
    if (
      !window.confirm(
        `${action} this ${kind.slice(0, -1)}? Restore does not republish; version rollback creates a draft.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminRequest(
        `${endpoint}/${encodeURIComponent(String(item.id))}/${action}`,
        "POST",
        { revision: item.revision },
      );
      setNotice(`Content ${action} confirmed.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label={kind + " management"}>
      <Feedback error={error} notice={notice} />
      <form
        className={ui.card + " flex flex-wrap items-end gap-3"}
        onSubmit={(e) => {
          e.preventDefault();
          void load(0);
        }}
      >
        <label className="min-w-0 basis-full text-sm font-semibold sm:flex-1 sm:basis-0">
          Search content
          <input
            className={ui.field}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
          />
        </label>
        <label className="text-sm font-semibold">
          Publication
          <select
            className={ui.field}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["all", "published", "draft", "archived"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button disabled={busy || editing !== null} className={ui.button}>
          Search / refresh
        </button>
        <button
          disabled={busy || !loaded || editing !== null}
          type="button"
          className={ui.primary}
          onClick={() => {
            setEditing({ ...empty[kind] });
            setPreview(false);
          }}
        >
          Add new
        </button>
      </form>
      {busy && <p role="status">Loading…</p>}
      {editing && (
        <form className={ui.card + " space-y-4"} onSubmit={save}>
          <h3 className="text-lg font-bold">
            {editing.id ? "Edit draft" : "Create draft"}
          </h3>
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            {fields[kind]
              .filter((f) => !["is_active", "is_published"].includes(f.key))
              .map((f) => (
                <label
                  key={f.key}
                  className={
                    "text-sm font-semibold " +
                    (["textarea", "list"].includes(f.type || "")
                      ? "sm:col-span-2"
                      : "")
                  }
                >
                  {f.label}
                  {f.type === "boolean" ? (
                    <input
                      className="ml-3"
                      type="checkbox"
                      checked={Boolean(editing[f.key])}
                      onChange={(e) =>
                        setEditing({ ...editing, [f.key]: e.target.checked })
                      }
                    />
                  ) : f.type === "select" ? (
                    <select
                      className={ui.field}
                      value={String(editing[f.key] ?? "")}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          [f.key]: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Not specified</option>
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  ) : ["textarea", "list"].includes(f.type || "") ? (
                    <textarea
                      required={f.required}
                      className={ui.field}
                      rows={4}
                      value={
                        Array.isArray(editing[f.key])
                          ? (editing[f.key] as string[]).join("\n")
                          : String(editing[f.key] ?? "")
                      }
                      onChange={(e) =>
                        setEditing({ ...editing, [f.key]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      required={f.required}
                      readOnly={f.key === "slug" && Boolean(editing.id)}
                      className={ui.field}
                      type={f.type === "number" ? "number" : "text"}
                      min={1}
                      max={f.type === "number" ? 5 : undefined}
                      value={String(editing[f.key] ?? "")}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          [f.key]:
                            f.type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
          </fieldset>
          <p className="text-xs text-slate-500">
            Existing URL slugs are permanent. Testimonials must have permission
            to display customer names and media before publication.
          </p>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className={ui.primary}>
              Save draft
            </button>
            <button
              type="button"
              disabled={busy}
              className={ui.button}
              onClick={() => setPreview((v) => !v)}
            >
              Preview draft
            </button>
            <button
              type="button"
              disabled={busy}
              className={ui.button}
              onClick={() => {
                if (window.confirm("Discard unsaved edits?")) setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
          {preview && (
            <div className="border-t border-[#DCE3E8] pt-4">
              <Preview data={editing} />
            </div>
          )}
        </form>
      )}
      {loaded && !editing && (
        <div className={ui.card + " space-y-4"}>
          <h3 className="font-bold capitalize">
            {kind} ({total})
          </h3>
          {!items.length && (
            <p className="text-sm text-slate-500">
              No matching content. Change the filter or create a draft.
            </p>
          )}
          {items.map((item) => (
            <article
              key={String(item.id)}
              className="space-y-3 border-t border-[#DCE3E8] pt-4"
            >
              <div className="break-words">
                <h4 className="font-bold">
                  {String(item.name ?? item.title ?? item.customer_name)}
                </h4>
                <p className="text-sm text-slate-500">
                  {item.archived_at
                    ? "Archived"
                    : item.is_active || item.is_published
                      ? "Published"
                      : "Unpublished"}
                  {item.admin_draft ? " · Draft waiting for review" : ""} ·
                  Revision {String(item.revision)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.archived_at ? (
                  <button
                    disabled={busy}
                    className={ui.button}
                    onClick={() => void action(item, "restore")}
                  >
                    Restore archived item
                  </button>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      className={ui.button}
                      onClick={() => edit(item)}
                    >
                      Edit draft
                    </button>
                    <button
                      disabled={busy}
                      className={ui.primary}
                      onClick={() => void action(item, "publish")}
                    >
                      Publish
                    </button>
                    <button
                      disabled={busy || !(item.is_active || item.is_published)}
                      className={ui.button}
                      onClick={() => void action(item, "unpublish")}
                    >
                      Unpublish
                    </button>
                    <button
                      disabled={busy}
                      className={ui.button}
                      onClick={() => void action(item, "archive")}
                    >
                      Archive
                    </button>
                  </>
                )}
              </div>
              <details>
                <summary className="text-sm font-semibold">
                  Preview saved content
                </summary>
                <div className="mt-3">
                  <Preview data={(item.admin_draft as Row) ?? item} />
                </div>
              </details>
              <HistoryPanel
                entity={kind}
                id={String(item.id)}
                revision={Number(item.revision)}
                disabled={busy || Boolean(item.archived_at)}
                onRestore={() => {
                  setNotice(
                    "Earlier version restored as a draft. Review before publishing.",
                  );
                  void load();
                }}
              />
            </article>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={ui.button}
              disabled={busy || offset === 0}
              onClick={() => void load(Math.max(0, offset - 30))}
            >
              Previous
            </button>
            <span className="text-sm">
              {Math.min(offset + 1, total)}–{Math.min(offset + 30, total)} of{" "}
              {total}
            </span>
            <button
              className={ui.button}
              disabled={busy || offset + 30 >= total}
              onClick={() => void load(offset + 30)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
