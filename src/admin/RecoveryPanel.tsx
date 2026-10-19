import React, { useEffect, useState } from "react";
import { adminRequest, Feedback, ui, useUnsavedChanges } from "./ui";
export type RecoveryAction = {
  action: "verify_email" | "reset_password";
  token: string;
};
export function recoveryActionFromLocation(): RecoveryAction | null {
  const params = new URLSearchParams(window.location.hash.slice(1)),
    action = params.get("action"),
    token = params.get("token");
  if (
    !["verify_email", "reset_password"].includes(action || "") ||
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return null;
  return { action: action as RecoveryAction["action"], token };
}
export default function RecoveryPanel({
  action,
  onBack,
}: {
  action: RecoveryAction | null;
  onBack: () => void;
}) {
  const [available, setAvailable] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useUnsavedChanges(Boolean(password || confirm));
  useEffect(() => {
    if (!action)
      void adminRequest("/recovery/status")
        .then((d) => setAvailable(d.available))
        .catch(() => setError("Recovery availability could not be checked."));
  }, [action]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">
          {action?.action === "verify_email"
            ? "Verify owner email"
            : action
              ? "Choose a new password"
              : "Account recovery"}
        </h1>
        <p className="efb-muted mt-2">
          {action
            ? "Use this single-use link within 15 minutes. Successful verification or reset revokes every owner session."
            : "Recovery requires a previously verified email and configured delivery. Server-side owner recovery remains available if you are locked out."}
        </p>
      </div>
      <Feedback error={error} notice={notice} />
      {!notice && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (action?.action === "verify_email") {
                await adminRequest("/account/verify-email", "POST", {
                  token: action.token,
                });
                setNotice("Owner email verified. Sign in again.");
              } else if (action) {
                if (password !== confirm)
                  throw Error("Passwords do not match.");
                await adminRequest("/recovery/complete", "POST", {
                  token: action.token,
                  password,
                });
                setPassword("");
                setConfirm("");
                setNotice(
                  "Password changed and sessions revoked. Sign in with your new password.",
                );
              } else {
                setNotice(
                  (await adminRequest("/recovery/request", "POST", { email }))
                    .message,
                );
                setEmail("");
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!action && (
            <>
              <p className="efb-muted">
                {available
                  ? "Recovery delivery is configured; a running worker is still required."
                  : "Self-service email recovery is unavailable until the owner configures and approves delivery."}
              </p>
              <label className="block">
                Verified recovery email
                <input
                  className={ui.field}
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </>
          )}
          {action?.action === "reset_password" && (
            <>
              <label className="block">
                New password
                <input
                  className={ui.field}
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block">
                Confirm new password
                <input
                  className={ui.field}
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            className={ui.primary + " w-full"}
            disabled={busy || (!action && !available)}
          >
            {busy
              ? "Please wait…"
              : action?.action === "verify_email"
                ? "Verify email"
                : action
                  ? "Reset password"
                  : "Request recovery link"}
          </button>
        </form>
      )}
      <button
        type="button"
        disabled={busy}
        className={ui.button + " w-full"}
        onClick={onBack}
      >
        Back to sign in
      </button>
    </div>
  );
}
