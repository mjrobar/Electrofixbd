import ImageUpload from "./ImageUpload";
import React, { useEffect, useState } from "react";
import type { CmsDocument } from "../../server/cms-contract";
import {
  adminRequest,
  Feedback,
  HistoryPanel,
  ui,
  useUnsavedChanges,
} from "./ui";
type Definition = {
  id: string;
  title: string;
  source_path: string;
  field_count: number;
  action_count: number;
};
export default function CompleteCmsEditor({
  onDirty,
  onBusy,
}: {
  onDirty: (v: boolean) => void;
  onBusy: (v: boolean) => void;
}) {
  const [definitions, setDefinitions] = useState<Definition[]>([]),
    [id, setId] = useState(""),
    [data, setData] = useState<CmsDocument | null>(null),
    [template, setTemplate] = useState<CmsDocument | null>(null),
    [revision, setRevision] = useState(0),
    [state, setState] = useState("uninitialized"),
    [archived, setArchived] = useState(false),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false);
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    adminRequest("/cms/documents")
      .then((r) => {
        setDefinitions(r.definitions);
        setId(r.definitions[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);
  async function load(target = id) {
    setBusy(true);
    setError("");
    setData(null);
    try {
      const r = await adminRequest("/cms/documents/" + target);
      setTemplate(r.template);
      setData(r.item.draft?.groups ? r.item.draft : null);
      setRevision(r.item.revision);
      setState(r.item.publication_state);
      setArchived(Boolean(r.item.archived_at));
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (id) void load(id);
  }, [id]);
  function change(edit: (d: CmsDocument) => void) {
    if (!data) return;
    const copy = structuredClone(data);
    edit(copy);
    setData(copy);
    setDirty(true);
  }
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const r = await adminRequest("/cms/documents/" + id + "/draft", "PUT", {
        revision,
        data,
      });
      setData(r.item.draft);
      setRevision(r.item.revision);
      setDirty(false);
      setNotice("Draft saved. Publication is unchanged.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(action: string) {
    if (
      !window.confirm(
        action + " this section? Restore never publishes automatically.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("/cms/documents/" + id + "/" + action, "POST", {
        revision,
      });
      await load();
      setNotice("Section " + action + " confirmed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={ui.card + " mt-6 space-y-4"}
      aria-label="Complete website CMS"
    >
      <h2 className="text-xl font-bold">Complete website CMS</h2>
      <p className="text-sm text-slate-500">
        Section copy, nested lists, media, labels and approved actions. Public
        layout and code stay with the original website. Publishing requires
        frontend-owner integration.
      </p>
      <Feedback error={error} notice={notice} />
      <label className="block text-sm font-semibold">
        Website section
        <select
          className={ui.field}
          disabled={busy}
          value={id}
          onChange={(e) => {
            if (!dirty || window.confirm("Discard unsaved section edits?")) {
              setDirty(false);
              setId(e.target.value);
              setNotice("");
              setPreview(false);
            }
          }}
        >
          {definitions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} · {d.field_count} fields · {d.action_count} actions
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-slate-500">
        {state} · Revision {revision}
        {archived ? " · Archived" : ""}
      </p>
      {busy && <p role="status">Loading…</p>}
      {!data && template && !busy && (
        <div className="space-y-3">
          <p className="text-sm">
            No complete draft saved for this section. Use the full import, or
            explicitly start a draft from its pinned static baseline.
          </p>
          <button
            className={ui.button}
            disabled={archived}
            onClick={() => {
              setData(structuredClone(template));
              setDirty(true);
            }}
          >
            Start draft from static baseline
          </button>
        </div>
      )}
      {data && (
        <fieldset disabled={busy || archived} className="space-y-4">
          {data.groups.map((group, gi) => (
            <details
              key={group.id}
              className="space-y-3 rounded-md border border-[#DCE3E8] p-4"
            >
              <summary className="cursor-pointer font-semibold">
                {group.label.replace(/([a-z])([A-Z])/g, "$1 $2")} (
                {group.items.length})
              </summary>
              {group.items.map((item, ii) => (
                <div
                  key={item.id}
                  className="mt-3 space-y-3 border-t border-[#DCE3E8] pt-3"
                >
                  {group.repeatable && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm font-semibold">
                        Item {ii + 1}
                      </span>
                      {[-1, 1].map((direction) => (
                        <button
                          key={direction}
                          type="button"
                          className={ui.button}
                          disabled={
                            ii + direction < 0 ||
                            ii + direction >= group.items.length
                          }
                          onClick={() =>
                            change((d) => {
                              const a = d.groups[gi].items;
                              [a[ii], a[ii + direction]] = [
                                a[ii + direction],
                                a[ii],
                              ];
                            })
                          }
                        >
                          {direction === -1 ? "Up" : "Down"}
                        </button>
                      ))}
                      <button
                        className={ui.button}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Remove this item from the draft? Saved versions remain in history.",
                            )
                          )
                            change((d) => {
                              d.groups[gi].items.splice(ii, 1);
                            });
                        }}
                      >
                        Remove item
                      </button>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {item.fields.map((field, fi) => (
                      <div
                        key={field.id}
                        className={
                          "min-w-0 text-sm font-semibold " +
                          (["text", "template"].includes(field.kind)
                            ? "sm:col-span-2"
                            : "")
                        }
                      >
                        <label className="block">
                          {field.label}
                          {field.kind === "boolean" ? (
                            <input
                              className="ml-3"
                              type="checkbox"
                              checked={Boolean(field.value)}
                              onChange={(e) =>
                                change((d) => {
                                  d.groups[gi].items[ii].fields[fi].value =
                                    e.target.checked;
                                })
                              }
                            />
                          ) : ["text", "template"].includes(field.kind) ? (
                            <textarea
                              aria-label={field.label}
                              className={ui.field}
                              rows={String(field.value).length > 150 ? 4 : 2}
                              value={String(field.value)}
                              onChange={(e) =>
                                change((d) => {
                                  d.groups[gi].items[ii].fields[fi].value =
                                    e.target.value;
                                })
                              }
                            />
                          ) : (
                            <input
                              className={ui.field}
                              type={field.kind === "number" ? "number" : "text"}
                              value={String(field.value)}
                              onChange={(e) =>
                                change((d) => {
                                  d.groups[gi].items[ii].fields[fi].value =
                                    field.kind === "number"
                                      ? Number(e.target.value)
                                      : e.target.value;
                                })
                              }
                            />
                          )}
                          {field.kind === "template" && (
                            <span className="block text-xs font-normal text-slate-500">
                              Keep the binding placeholders; the website
                              supplies their values.
                            </span>
                          )}
                        </label>
                        {field.kind === "media" && (
                          <ImageUpload
                            disabled={busy || archived}
                            onBusy={setBusy}
                            onUpload={(url) =>
                              change((d) => {
                                d.groups[gi].items[ii].fields[fi].value = url;
                              })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {group.repeatable && (
                <button
                  className={ui.button + " mt-3"}
                  onClick={() => {
                    const original = template?.groups.find(
                      (g) => g.id === group.id,
                    )?.items[0];
                    if (original)
                      change((d) => {
                        const clone = structuredClone(original);
                        clone.id = "item_" + crypto.randomUUID();
                        clone.fields.forEach((f) => {
                          f.id = "f_" + crypto.randomUUID();
                        });
                        d.groups[gi].items.push(clone);
                      });
                  }}
                >
                  Add item to {group.label}
                </button>
              )}
            </details>
          ))}
          {data.actions.length > 0 && (
            <details className="rounded-md border border-[#DCE3E8] p-4">
              <summary className="cursor-pointer font-semibold">
                CTA actions ({data.actions.length})
              </summary>
              {data.actions.map((a, i) => (
                <div
                  key={a.id}
                  className="mt-4 grid gap-3 border-t border-[#DCE3E8] pt-3 sm:grid-cols-2"
                >
                  <strong className="text-sm sm:col-span-2">{a.label}</strong>
                  <label className="text-sm font-semibold">
                    Action type
                    <select
                      className={ui.field}
                      disabled={a.kind === "interaction"}
                      value={a.kind}
                      onChange={(e) =>
                        change((d) => {
                          d.actions[i].kind = e.target.value as typeof a.kind;
                        })
                      }
                    >
                      {(a.kind === "interaction"
                        ? ["interaction"]
                        : [
                            "booking",
                            "navigate",
                            "phone",
                            "whatsapp",
                            "external",
                          ]
                      ).map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    Destination override
                    <input
                      disabled={
                        a.kind === "interaction" || a.kind === "booking"
                      }
                      className={ui.field}
                      value={a.destination}
                      onChange={(e) =>
                        change((d) => {
                          d.actions[i].destination = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label className="text-sm font-semibold">
                    Booking service hint
                    <input
                      className={ui.field}
                      disabled={a.kind !== "booking"}
                      value={a.service_hint}
                      onChange={(e) =>
                        change((d) => {
                          d.actions[i].service_hint = e.target.value;
                        })
                      }
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Empty destinations retain original dynamic bindings.
                    Interactions such as closing a modal stay in website code.
                  </p>
                </div>
              ))}
            </details>
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className={ui.primary}
          disabled={busy || !data || !dirty || archived}
          onClick={() => void save()}
        >
          Save section draft
        </button>
        <button
          className={ui.button}
          disabled={busy || dirty || !revision || archived || !data}
          onClick={() => void action("publish")}
        >
          Publish section
        </button>
        <button
          className={ui.button}
          disabled={busy || dirty || !revision || archived}
          onClick={() => void action("unpublish")}
        >
          Unpublish section
        </button>
        <button
          className={ui.button}
          disabled={busy || dirty || !revision}
          onClick={() => void action(archived ? "restore" : "archive")}
        >
          {archived ? "Restore section" : "Archive section"}
        </button>
        <button
          className={ui.button}
          disabled={busy || !data}
          onClick={() => setPreview(!preview)}
        >
          Preview section draft
        </button>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved edits?")) void load();
          }}
        >
          Reload section
        </button>
      </div>
      {preview && data && (
        <div className="space-y-3 rounded-md border border-[#DCE3E8] p-4">
          {data.groups.map((g) => (
            <div key={g.id}>
              <h3 className="font-semibold">{g.label}</h3>
              {g.items.map((item) => (
                <dl key={item.id} className="mt-2 space-y-2">
                  {item.fields.map((f) => (
                    <div key={f.id}>
                      <dt className="text-xs text-slate-500">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-sm">
                        {String(f.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          ))}
        </div>
      )}
      {id && (
        <HistoryPanel
          entity="cms_documents"
          id={id}
          revision={revision}
          disabled={busy || dirty || archived}
          onRestore={() => void load()}
        />
      )}
    </section>
  );
}
