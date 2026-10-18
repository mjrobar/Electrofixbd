import React, { useEffect, useState } from "react";
import { useUnsavedChanges, HistoryPanel, Preview, ui } from "./ui";
import ContentImportPanel from "./ContentImportPanel";
type Key = "hero_slides" | "faqs" | "business_settings" | "page_sections";
type Row = Record<string, unknown>;
const fields: Record<
  Key,
  { key: string; label: string; multiline?: boolean; options?: string[] }[]
> = {
  hero_slides: [
    { key: "id", label: "Unique ID" },
    { key: "badge", label: "Badge" },
    {
      key: "primary_action",
      label: "Primary action",
      options: ["booking", "navigate", "phone", "whatsapp"],
    },
    { key: "service_hint", label: "Booking service hint" },
    { key: "secondary_label", label: "Secondary button text" },
    {
      key: "secondary_action",
      label: "Secondary action",
      options: ["none", "booking", "navigate", "phone", "whatsapp"],
    },
    { key: "secondary_url", label: "Secondary button link" },
    { key: "title", label: "Headline" },
    { key: "subtitle", label: "Subtitle" },
    { key: "description", label: "Description", multiline: true },
    { key: "image_url", label: "Image HTTPS URL" },
    { key: "button_label", label: "Button text" },
    { key: "button_url", label: "Button link" },
  ],
  faqs: [
    { key: "id", label: "Unique ID" },
    { key: "question", label: "Question" },
    { key: "answer", label: "Answer", multiline: true },
    { key: "category", label: "Category" },
  ],
  business_settings: [
    { key: "short_name", label: "Short business name" },
    { key: "tagline", label: "Tagline" },
    { key: "service_coverage", label: "Service coverage" },
    { key: "experience", label: "Experience statement" },
    { key: "circuit_board_specialty", label: "Circuit board specialty" },
    { key: "phone_clean", label: "Phone digits for calls" },
    { key: "phone_international", label: "International phone" },
    { key: "about_image_url", label: "About image URL" },
    { key: "business_name", label: "Business name" },
    { key: "phone", label: "Phone" },
    { key: "whatsapp", label: "WhatsApp number" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "hours", label: "Business hours" },
    { key: "facebook_url", label: "Facebook URL" },
    { key: "youtube_url", label: "YouTube URL" },
    { key: "logo_url", label: "Logo URL" },
  ],
  page_sections: [
    { key: "id", label: "Unique ID" },
    {
      key: "page",
      label: "Page",
      options: ["home", "services", "works", "contact", "about"],
    },
    { key: "section", label: "Section key" },
    { key: "heading", label: "Heading" },
    { key: "body", label: "Body", multiline: true },
    { key: "image_url", label: "Image URL" },
    { key: "eyebrow", label: "Section credential / eyebrow" },
    { key: "eyebrow_secondary", label: "Secondary eyebrow" },
    { key: "group_heading", label: "Highlight group heading" },
  ],
};
const defaults: Record<Key, Row> = {
  hero_slides: {
    actions_configured: false,
    badge: "",
    primary_action: "booking",
    service_hint: "",
    secondary_label: "",
    secondary_action: "none",
    secondary_url: "",
    id: "",
    title: "",
    subtitle: "",
    description: "",
    image_url: "",
    button_label: "",
    button_url: "",
    is_active: true,
  },
  faqs: {
    id: "",
    question: "",
    answer: "",
    category: "General",
    is_active: true,
  },
  business_settings: {
    business_name: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    hours: "",
    facebook_url: "",
    youtube_url: "",
    logo_url: "",
  },
  page_sections: {
    id: "",
    page: "home",
    section: "",
    heading: "",
    body: "",
    image_url: "",
    eyebrow: "",
    eyebrow_secondary: "",
    group_heading: "",
    highlights: [],
    statistics: [],
    is_active: true,
  },
};
export default function SiteControlsEditor() {
  const [key, setKey] = useState<Key>("hero_slides");
  const [importBusy, setImportBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  function switchModule(next: Key) {
    if (busy || importBusy || next === key) return;
    if (dirty && !window.confirm("Discard unsaved edits and switch modules?"))
      return;
    setDirty(false);
    setKey(next);
  }
  return (
    <>
      <ContentImportPanel
        onBusy={setImportBusy}
        blocked={dirty || busy}
        onImported={() => {
          setDirty(false);
          setGeneration((value) => value + 1);
        }}
      />
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          ["hero_slides", "faqs", "business_settings", "page_sections"] as const
        ).map((k) => (
          <button
            disabled={busy || importBusy}
            type="button"
            key={k}
            onClick={() => switchModule(k)}
            className={
              "rounded-md border px-3 py-2 text-sm font-semibold disabled:opacity-50 " +
              (key === k
                ? "border-[#004179] bg-[#004179] text-white"
                : "border-slate-200 bg-white text-slate-700")
            }
          >
            {k.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <ModuleEditor
        key={key + generation}
        moduleKey={key}
        disabled={importBusy}
        onDirty={setDirty}
        onBusy={setBusy}
      />
    </>
  );
}
function ModuleEditor({
  moduleKey: key,
  onDirty,
  onBusy,
  disabled,
}: {
  moduleKey: Key;
  disabled: boolean;
  onDirty: (value: boolean) => void;
  onBusy: (value: boolean) => void;
}) {
  const [data, setData] = useState<Row | Row[]>([]);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const [published, setPublished] = useState<unknown>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    onBusy(loading);
    return () => onBusy(false);
  }, [loading, onBusy]);
  async function request(path: string, method = "GET", body?: unknown) {
    const response = await fetch("/api/admin/site-content/" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(method !== "GET" ? { "X-Admin-Request": "1" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json().catch(() => ({}));
    if (response.status === 401)
      window.dispatchEvent(new Event("admin-session-expired"));
    if (!response.ok)
      throw Error(
        value.issues?.length
          ? value.issues
              .map(
                (issue: { field: string; message: string }) =>
                  `${issue.field}: ${issue.message}`,
              )
              .join("; ")
          : value.error || "Unable to complete request.",
      );
    return value.item;
  }
  async function reload() {
    setLoading(true);
    setLoaded(false);
    setError("");
    setNotice("");
    try {
      const item = await request(key);
      setData(
        key === "business_settings"
          ? { ...defaults.business_settings, ...item.draft }
          : Array.isArray(item.draft)
            ? item.draft.map((row: Row) => ({ ...defaults[key], ...row }))
            : item.draft,
      );
      setRevision(item.revision);
      setPublished(item.published);
      setEditing(null);
      setLoaded(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading failed");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setData(
      key === "business_settings" ? { ...defaults.business_settings } : [],
    );
    setNotice("");
    void reload();
  }, [key]);
  function change(index: number, field: string, value: unknown) {
    setDirty(true);
    if (key === "business_settings") {
      setData((prev) => ({ ...(prev as Row), [field]: value }));
      return;
    }
    setData((prev) =>
      (prev as Row[]).map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  }
  function changeNested(index: number, field: "highlights" | "statistics", itemIndex: number, property: string, value: string) {
    setDirty(true);
    setData(prev => (prev as Row[]).map((row, i) => {
      if (i !== index) return row;
      const nested = Array.isArray(row[field]) ? [...row[field] as Row[]] : [];
      nested[itemIndex] = {...nested[itemIndex], [property]: property === "value" ? (Number(value) || 0) : value};
      return {...row, [field]: nested};
    }));
  }
  function addNested(index: number, field: "highlights" | "statistics") {
    setDirty(true);
    setData(prev => (prev as Row[]).map((row, i) => i !== index ? row : {
      ...row, [field]: [...(Array.isArray(row[field]) ? row[field] as Row[] : []),
        field === "highlights" ? {id:crypto.randomUUID(),icon:"none",title:"",subtitle:"",description:""} :
          {id:crypto.randomUUID(),value:0,suffix:"",label:""}],
    }));
  }
  function removeNested(index: number, field: "highlights" | "statistics", child: number) {
    setDirty(true);
    setData(prev => (prev as Row[]).map((row, i) => i !== index ? row : {
      ...row, [field]: (Array.isArray(row[field]) ? row[field] as Row[] : []).filter((_,j)=>j!==child),
    }));
  }
  function move(index: number, delta: number) {
    setData((prev) => {
      const rows = [...(prev as Row[])];
      [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]];
      return rows;
    });
    setDirty(true);
    setEditing(null);
  }
  function add() {
    setDirty(true);
    if (key === "business_settings") return;
    setData((prev) => [
      ...(prev as Row[]),
      {
        ...defaults[key],
        ...(key === "hero_slides" ? { actions_configured: true } : {}),
        id: crypto.randomUUID(),
      },
    ]);
    setEditing((data as Row[]).length);
  }
  async function save() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const item = await request(key + "/draft", "PUT", { data, revision });
      setRevision(item.revision);
      setPublished(item.published);
      setData(item.draft);
      setDirty(false);
      setNotice("Draft saved. Public website has not been changed.");
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }
  async function publish() {
    if (dirty) return;
    if (
      !window.confirm(
        "Publish the saved draft? This makes the module available to the public website API.",
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      const item = await request(key + "/publish", "POST", { revision });
      setRevision(item.revision);
      setPublished(item.published);
      setNotice(
        "Published successfully. Google AI Studio must connect the frontend to this API.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setLoading(false);
    }
  }
  async function unpublish() {
    if (
      !window.confirm(
        "Unpublish this module? Existing public frontend fallback may still display its static content.",
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      const item = await request(key + "/unpublish", "POST", { revision });
      setRevision(item.revision);
      setPublished(item.published);
      setNotice(
        "Module unpublished. Static frontend fallback remains owned by AI Studio.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const items =
    key === "business_settings"
      ? [data as Row]
      : Array.isArray(data)
        ? data
        : [];
  return (
    <section className="mt-6 space-y-4 rounded-lg border border-[#DCE3E8] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Website Controls</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create drafts, review and publish when ready.
          </p>
        </div>
        <span className="text-xs text-slate-500">Revision {revision}</span>
      </div>
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
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      )}
      <button
        disabled={loading || disabled}
        type="button"
        onClick={() => {
          if (!dirty || window.confirm("Discard unsaved edits and reload?"))
            void reload();
        }}
        className="text-sm font-semibold text-[#004179] disabled:opacity-50"
      >
        Reload saved content
      </button>
      {loaded && items.length === 0 && (
        <p className="text-sm text-slate-500">
          No draft items yet. Preview the existing content import above or add
          an item.
        </p>
      )}
      <fieldset disabled={loading || disabled || !loaded} className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="min-w-0 break-words text-sm">
                {String(
                  item.title ||
                    item.question ||
                    item.heading ||
                    item.business_name ||
                    (key === "business_settings"
                      ? "Business settings"
                      : "New item"),
                )}
              </strong>
              {key !== "business_settings" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label={"Move item " + (i + 1) + " up"}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="text-xs font-semibold"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    aria-label={"Move item " + (i + 1) + " down"}
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                    className="text-xs font-semibold"
                  >
                    Down
                  </button>
                </div>
              )}
              <button
                type="button"
                className="text-sm font-semibold text-[#004179]"
                onClick={() => setEditing(editing === i ? null : i)}
              >
                {editing === i ? "Close" : "Edit"}
              </button>
            </div>
            {editing === i || key === "business_settings" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {fields[key].map((f) => (
                  <label
                    key={f.key}
                    className={
                      "text-xs font-semibold text-slate-700 " +
                      (f.multiline ? "sm:col-span-2" : "")
                    }
                  >
                    {f.label}
                    {f.multiline ? (
                      <textarea
                        rows={4}
                        readOnly={f.key === "id"}
                        value={String(item[f.key] ?? "")}
                        onChange={(e) => change(i, f.key, e.target.value)}
                        className="mt-1 block w-full border border-slate-200 p-3 text-sm"
                      />
                    ) : f.options ? (
                      <select
                        value={String(item[f.key] ?? f.options[0])}
                        onChange={(e) => change(i, f.key, e.target.value)}
                        className="mt-1 block w-full border border-slate-200 p-3 text-sm"
                      >
                        {f.options.map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        readOnly={f.key === "id"}
                        value={String(item[f.key] ?? "")}
                        onChange={(e) => change(i, f.key, e.target.value)}
                        className="mt-1 block w-full border border-slate-200 p-3 text-sm"
                      />
                    )}
                  </label>
                ))}
                {key === "page_sections" && (["highlights","statistics"] as const).map((field) => (
                  <div key={field} className="col-span-full space-y-2 rounded-md border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm capitalize">{field}</strong>
                      <button type="button" className="text-xs font-bold text-[#004179]" onClick={()=>addNested(i,field)}>Add {field === "highlights" ? "highlight" : "statistic"}</button>
                    </div>
                    {(Array.isArray(item[field]) ? item[field] as Row[] : []).map((child,j)=>(
                      <div key={String(child.id ?? j)} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2">
                        {(field === "highlights" ? ["icon","title","subtitle","description"] : ["value","suffix","label"]).map(prop=>(
                          <label key={prop} className="text-xs font-medium capitalize">
                            {prop}
                            {prop === "icon" ? <select className="mt-1 w-full border p-2" value={String(child.icon ?? "none")} onChange={e=>changeNested(i,field,j,prop,e.target.value)}>
                              {["none","cpu","map-pin","settings","shield-check"].map(icon=><option key={icon} value={icon}>{icon}</option>)}
                            </select> : <input className="mt-1 w-full border p-2" type={prop === "value" ? "number" : "text"} value={String(child[prop] ?? "")} onChange={e=>changeNested(i,field,j,prop,e.target.value)}/>}
                          </label>
                        ))}
                        <button type="button" className="text-xs text-red-700" onClick={()=>removeNested(i,field,j)}>Remove {field === "highlights" ? "highlight" : "statistic"}</button>
                      </div>
                    ))}
                  </div>
                ))}
                {key === "hero_slides" && (
                  <label className="col-span-full flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.actions_configured === true}
                      onChange={(e) =>
                        change(i, "actions_configured", e.target.checked)
                      }
                    />
                    Use custom hero actions instead of the shipped legacy
                    buttons
                  </label>
                )}
                {key !== "business_settings" && (
                  <label className="col-span-full flex gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.is_active !== false}
                      onChange={(e) => change(i, "is_active", e.target.checked)}
                    />
                    Active
                  </label>
                )}
                {key !== "business_settings" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Remove this item from the draft? You can restore saved versions from history.",
                        )
                      )
                        return;
                      setDirty(true);
                      setData((prev) =>
                        (prev as Row[]).filter((_, j) => j !== i),
                      );
                      setEditing(null);
                    }}
                    className="rounded-md border border-red-200 p-2 text-xs text-red-700"
                  >
                    Remove from draft
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {key !== "business_settings" && (
          <button
            disabled={loading || disabled || !loaded}
            onClick={add}
            type="button"
            className="rounded-md border border-[#004179] px-4 py-2.5 text-sm font-bold text-[#004179]"
          >
            Add item
          </button>
        )}
        <button
          onClick={() => void save()}
          disabled={loading || disabled || !loaded || !dirty}
          type="button"
          className="rounded-md bg-[#004179] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          onClick={() => void publish()}
          disabled={loading || disabled || !loaded || dirty || revision === 0}
          type="button"
          className="rounded-md border border-emerald-600 px-4 py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-50"
        >
          Publish saved draft
        </button>
      </div>
      {dirty && (
        <p role="status" className="text-sm text-slate-500">
          Unsaved edits. Save the draft before publishing.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={loading || !loaded}
          type="button"
          className={ui.button}
          onClick={() => setPreview((v) => !v)}
        >
          Preview current draft
        </button>
        <span className="text-sm text-slate-500">
          {revision === 0
            ? "No saved draft"
            : published &&
                (Array.isArray(published)
                  ? published.length
                  : Object.keys(published as object).length)
              ? "Saved publication available"
              : "No published values"}
        </span>
      </div>
      {preview && (
        <div className="space-y-4 rounded-md border border-[#DCE3E8] p-4">
          {items.map((row, i) => (
            <Preview key={i} data={row} />
          ))}
        </div>
      )}
      <button
        type="button"
        className={ui.button}
        disabled={loading || disabled || !loaded || dirty || revision === 0}
        onClick={() => void unpublish()}
      >
        Unpublish module
      </button>
      <HistoryPanel
        entity="site_content"
        id={key}
        revision={revision}
        disabled={loading || disabled || !loaded || dirty}
        onRestore={() => void reload()}
      />
      <p className="text-xs leading-5 text-slate-500">
        Publishing exposes JSON through /api/site-content/{key}. The public
        website remains unchanged until Google AI Studio integrates these
        endpoints.
      </p>
    </section>
  );
}
