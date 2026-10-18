import React, { useState } from "react";
import { ui } from "./ui";
export default function ImageUpload({
  disabled,
  onBusy,
  onUpload,
}: {
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onUpload: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState("");
  return (
    <div className="mt-2 space-y-2 font-normal">
      <label className="block text-sm font-semibold">
        Upload from device
        <input
          className={ui.field}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            if (file.size > 5 * 1024 * 1024) {
              setError("Choose an image up to 5 MiB.");
              return;
            }
            setBusy(true);
            onBusy(true);
            try {
              const response = await fetch("/api/admin/media", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": file.type, "X-Admin-Request": "1" },
                body: file,
              });
              const result = await response.json();
              if (response.status === 401)
                window.dispatchEvent(new Event("admin-session-expired"));
              if (!response.ok)
                throw Error(
                  result.error?.message || result.error || "Upload failed.",
                );
              onUpload(result.image.url);
              setPreview(result.image.preview_url);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
            }
          }}
        />
      </label>
      <p className="text-xs text-slate-500">
        JPEG, PNG or WebP, up to 5 MiB. External HTTPS URLs remain supported.
        Uploading does not publish.
      </p>
      {busy && <p role="status">Uploading image…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {preview && (
        <img
          src={preview}
          alt="Uploaded image preview"
          className="max-h-32 max-w-full rounded border border-[#DCE3E8]"
        />
      )}
    </div>
  );
}
