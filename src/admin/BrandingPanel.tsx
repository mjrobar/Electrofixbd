import React, { useEffect, useRef, useState } from "react";
import { adminRequest, Feedback, ui, useUnsavedChanges, type Row } from "./ui";
const imagePreview = (url: string) =>
  /^\/api\/media\/[a-f0-9-]{36}$/.test(url)
    ? "/api/admin/media/" + url.split("/").pop() + "/blob"
    : url;
export default function BrandingPanel() {
  const [item, setItem] = useState<Row | null>(null),
    [draft, setDraft] = useState<Row>({}),
    [baseline, setBaseline] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const dirty = Boolean(item) && JSON.stringify(draft) !== baseline;
  useUnsavedChanges(dirty);
  async function load() {
    setBusy(true);
    try {
      const data = (await adminRequest("/site-content/business_settings")).item;
      setItem(data);
      setDraft(data.draft);
      setBaseline(JSON.stringify(data.draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await adminRequest(
        "/site-content/business_settings/draft",
        "PUT",
        { data: draft, revision: item!.revision },
      );
      setItem(data.item);
      setDraft(data.item.draft);
      setBaseline(JSON.stringify(data.item.draft));
      setNotice(
        "Branding draft saved in the existing business settings. Nothing was published.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (
      !window.confirm(
        "Publish the complete saved Business settings draft, including any existing contact/business edits? Public frontend adoption still requires its owner's integration.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const data = await adminRequest(
        "/site-content/business_settings/publish",
        "POST",
        { revision: item!.revision },
      );
      setItem(data.item);
      setNotice(
        "Business settings published to the API. Existing public components require the approved frontend integration before branding changes appear there.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={ui.card + " space-y-5"}
      aria-label="Website branding"
      data-admin-busy={busy || uploading}
    >
      <div className="efb-section-heading">
        <div>
          <h2>Website branding</h2>
          <p className="efb-muted">
            The same Business settings used by Website Content. One draft, one
            publication and one revision history.
          </p>
        </div>
      </div>
      <Feedback error={error} notice={notice} />
      {item ? (
        <>
          <label className="block">
            Business name
            <input
              className={ui.field}
              maxLength={150}
              value={String(draft.business_name ?? "")}
              disabled={busy || uploading}
              onChange={(e) =>
                setDraft((d) => ({ ...d, business_name: e.target.value }))
              }
            />
          </label>
          <label className="block">
            Website document title
            <input
              className={ui.field}
              maxLength={150}
              value={String(draft.site_title ?? "")}
              disabled={busy || uploading}
              onChange={(e) =>
                setDraft((d) => ({ ...d, site_title: e.target.value }))
              }
            />
          </label>
          <div className="efb-branding-grid">
            {(
              [
                ["logo_url", "Primary logo"],
                ["favicon_url", "Favicon"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="efb-branding-asset">
                <h3>{label}</h3>
                <p className="efb-muted">
                  {key === "logo_url"
                    ? "512×512 square or 1200×400 horizontal. Retain padding around the brand mark."
                    : "Upload a square source. Preview at 48, 192 and 512 px; published PNG derivatives are available at all three sizes."}
                </p>
                <BrandCrop
                  kind={key === "logo_url" ? "logo" : "favicon"}
                  disabled={busy || uploading}
                  onBusy={setUploading}
                  onUpload={(url) => setDraft((d) => ({ ...d, [key]: url }))}
                />
                {draft[key] ? (
                  <div className="efb-brand-preview">
                    <p className="efb-muted">
                      Draft preview · uploading never publishes
                    </p>
                    <div className="efb-brand-preview-sizes">
                      {(key === "logo_url" ? [48, 96] : [24, 48, 96]).map(
                        (size) => (
                          <img
                            key={size}
                            src={imagePreview(String(draft[key]))}
                            width={size}
                            height={size}
                            alt={`${label} preview at ${size}px`}
                            style={{
                              width: size,
                              height: size,
                              objectFit: "contain",
                            }}
                          />
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      className={ui.button}
                      disabled={busy || uploading}
                      onClick={() => setDraft((d) => ({ ...d, [key]: "" }))}
                    >
                      Remove {label.toLowerCase()} from draft
                    </button>
                  </div>
                ) : (
                  <p className="efb-muted">
                    No {label.toLowerCase()} in this draft.
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="efb-brand-browser-preview">
            <small>Browser title preview</small>
            <strong>
              {String(
                draft.site_title || draft.business_name || "ElectroFix BD",
              )}
            </strong>
            <p className="efb-muted">
              Multi-size high-DPI artwork is rendered from the durable uploaded
              asset. Favicon PNG paths: /api/branding/favicon/48.png, /192.png
              and /512.png. ICO/SVG uploads are not supported.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={ui.primary}
              disabled={!dirty || busy || uploading}
              onClick={() => void save()}
            >
              Save branding draft
            </button>
            <button
              className={ui.button}
              disabled={
                dirty || busy || uploading || Number(item.revision) === 0
              }
              onClick={() => void publish()}
            >
              Publish saved Business settings
            </button>
          </div>
          <p className="efb-muted">
            Other Business settings fields are preserved in this draft. Use
            Website Content for full settings, version history and unpublish.
            Public navbar, favicon and document title remain unchanged until
            Google AI Studio integrates the published values.
          </p>
        </>
      ) : (
        <p role="status">
          {busy
            ? "Loading branding…"
            : "Branding unavailable. Reload Settings to retry."}
        </p>
      )}
    </section>
  );
}
function BrandCrop({
  kind,
  disabled,
  onBusy,
  onUpload,
}: {
  kind: "logo" | "favicon";
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onUpload: (url: string) => void;
}) {
  const [source, setSource] = useState<HTMLImageElement | null>(null),
    [sourceUrl, setSourceUrl] = useState(""),
    [shape, setShape] = useState("square"),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    canvas = useRef<HTMLCanvasElement>(null);
  useUnsavedChanges(Boolean(source));
  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );
  useEffect(() => {
    if (!source || !canvas.current) return;
    const horizontal = kind === "logo" && shape === "horizontal",
      width = horizontal ? 1200 : 512,
      height = horizontal ? 400 : 512,
      ratio = width / height;
    const cropW =
        Math.min(source.naturalWidth, source.naturalHeight * ratio) / zoom,
      cropH = cropW / ratio;
    canvas.current.width = width;
    canvas.current.height = height;
    const ctx = canvas.current.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(
      source,
      ((source.naturalWidth - cropW) * x) / 100,
      ((source.naturalHeight - cropH) * y) / 100,
      cropW,
      cropH,
      0,
      0,
      width,
      height,
    );
  }, [source, shape, zoom, x, y, kind]);
  return (
    <div className="space-y-3">
      <label className="block">
        Choose {kind} image
        <input
          className={ui.field}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            if (
              file.size > 5 * 1024 * 1024 ||
              !["image/png", "image/jpeg", "image/webp"].includes(file.type)
            ) {
              setError(
                "Choose PNG, JPEG or WebP up to 5 MiB. SVG and ICO are not accepted.",
              );
              return;
            }
            const url = URL.createObjectURL(file),
              image = new Image();
            image.onload = () => {
              if (
                image.naturalWidth > 6000 ||
                image.naturalHeight > 6000 ||
                image.naturalWidth * image.naturalHeight > 16000000
              ) {
                URL.revokeObjectURL(url);
                setError("Image exceeds 6000px per side / 16 million pixels.");
                return;
              }
              setSource(image);
              setSourceUrl(url);
              setZoom(1);
              setX(50);
              setY(50);
            };
            image.onerror = () => {
              URL.revokeObjectURL(url);
              setError("This image could not be decoded.");
            };
            image.src = url;
          }}
        />
      </label>
      {source && (
        <>
          <div className="efb-crop-preview">
            <canvas ref={canvas} aria-label={`${kind} crop preview`} />
          </div>
          {kind === "logo" && (
            <label className="block">
              Logo shape
              <select
                className={ui.field}
                value={shape}
                disabled={busy}
                onChange={(e) => setShape(e.target.value)}
              >
                <option value="square">Square · 512×512</option>
                <option value="horizontal">Horizontal · 1200×400</option>
              </select>
            </label>
          )}
          {(
            [
              ["Zoom", zoom, setZoom, 1, 3, 0.05],
              ["Horizontal position", x, setX, 0, 100, 1],
              ["Vertical position", y, setY, 0, 100, 1],
            ] as const
          ).map(([label, value, setValue, min, max, step]) => (
            <label className="block" key={label}>
              {kind} {label.toLowerCase()}
              <input
                className="block w-full mt-2"
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={busy}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={ui.button}
              disabled={disabled || busy}
              onClick={async () => {
                setBusy(true);
                onBusy(true);
                setError("");
                try {
                  const blob = await new Promise<Blob>((resolve, reject) =>
                    canvas.current!.toBlob(
                      (b) =>
                        b
                          ? resolve(b)
                          : reject(Error("Unable to prepare crop.")),
                      "image/png",
                    ),
                  );
                  const response = await fetch("/api/admin/media", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                      "Content-Type": "image/png",
                      "X-Admin-Request": "1",
                    },
                    body: blob,
                  });
                  const result = await response.json();
                  if (response.status === 401)
                    window.dispatchEvent(new Event("admin-session-expired"));
                  if (!response.ok)
                    throw Error(result.error || "Upload failed.");
                  onUpload(result.image.url);
                  setSource(null);
                  setSourceUrl("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                  onBusy(false);
                }
              }}
            >
              {busy ? "Uploading…" : "Upload reviewed crop"}
            </button>
            <button
              type="button"
              className={ui.button}
              disabled={busy}
              onClick={() => {
                setSource(null);
                setSourceUrl("");
              }}
            >
              Cancel crop
            </button>
          </div>
        </>
      )}
      <Feedback error={error} />
      <p className="efb-muted">
        Server validates and normalizes images, strips metadata and writes only
        to configured durable storage. Uploads remain private until published.
      </p>
    </div>
  );
}
