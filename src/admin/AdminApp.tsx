import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import "./admin.css";
import OperationsPanel from "./OperationsPanel";
import Dashboard from "./Dashboard";
import AdminDialog from "./AdminDialog";
import RecoveryPanel, {
  recoveryActionFromLocation,
  type RecoveryAction,
} from "./RecoveryPanel";
import {
  adminInteractionActive,
  adminRequest,
  canLeaveAdmin,
  Feedback,
  ui,
  type Row,
} from "./ui";
import {
  bookingAlerts,
  fetchBookingFeed,
  createAdminPoller,
  readCheckpoint,
  type BookingFeed,
} from "./live-data";
import { bdDate } from "./operations-model";
const ContentEditor = lazy(() => import("./ContentEditor"));
const SettingsPanel = lazy(() => import("./SettingsPanel"));
type Panel = "overview" | "bookings" | "contacts" | "content" | "settings";
const tabs = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "bookings", label: "Bookings", Icon: ClipboardList },
  { key: "contacts", label: "Messages", Icon: MessageSquare },
  { key: "content", label: "Website Content", Icon: FileText },
  { key: "settings", label: "Settings", Icon: Settings },
] as const;
const storage = {
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* optional storage */
    }
  },
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Storage is optional; never business persistence. */
    }
  },
};
function BangladeshClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <time
      className="efb-bd-clock"
      dateTime={now.toISOString()}
      aria-label="Bangladesh time (Asia/Dhaka)"
    >
      <span className="efb-clock-dot" aria-hidden="true" />
      BDT{" "}
      <strong>
        {new Intl.DateTimeFormat("en-BD", {
          timeZone: "Asia/Dhaka",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)}
      </strong>
      <span className="efb-clock-date">
        {new Intl.DateTimeFormat("en-BD", {
          timeZone: "Asia/Dhaka",
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(now)}
      </span>
    </time>
  );
}
export default function AdminApp() {
  const [checking, setChecking] = useState(true),
    [authenticated, setAuthenticated] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [panel, setPanel] = useState<Panel>("overview"),
    [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false),
    [overview, setOverview] = useState<Row | null>(null),
    [bookings, setBookings] = useState<Row[]>([]),
    [refreshing, setRefreshing] = useState(false),
    [refreshVersion, setRefreshVersion] = useState(0),
    [dark, setDark] = useState(() => storage.get("efb-admin-theme") === "dark"),
    [feed, setFeed] = useState<BookingFeed | null>(null),
    [liveState, setLiveState] = useState("Connecting…"),
    [toast, setToast] = useState(""),
    [permission, setPermission] = useState(() =>
      "Notification" in window ? Notification.permission : "unavailable",
    ),
    [recovering, setRecovering] = useState(false),
    [action, setAction] = useState<RecoveryAction | null>(
      recoveryActionFromLocation,
    );
  const inFlight = useRef(false),
    mainAbort = useRef<AbortController | null>(null),
    checkpoint = useRef(readCheckpoint(storage.get("efb-admin-alerts-v1"))),
    lastChange = useRef<string | null>(null),
    poll = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    storage.set("efb-admin-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (action)
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }, [action]);
  function clearSession() {
    mainAbort.current?.abort();
    setAuthenticated(false);
    setOverview(null);
    setBookings([]);
    setFeed(null);
    setNotifications(false);
    lastChange.current = null;
  }
  useEffect(() => {
    const abort = new AbortController();
    void adminRequest("/me", "GET", undefined, abort.signal)
      .then(() => {
        if (!abort.signal.aborted) setAuthenticated(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!abort.signal.aborted) setChecking(false);
      });
    const expired = () => clearSession();
    window.addEventListener("admin-session-expired", expired);
    return () => {
      abort.abort();
      window.removeEventListener("admin-session-expired", expired);
    };
  }, []);
  async function load(silent = false, signal = mainAbort.current?.signal) {
    if (inFlight.current || signal?.aborted) return;
    inFlight.current = true;
    if (!silent) {
      setRefreshing(true);
      setError("");
    }
    try {
      const [a, b] = await Promise.all([
        adminRequest("/overview", "GET", undefined, signal),
        adminRequest("/bookings", "GET", undefined, signal),
      ]);
      if (!signal?.aborted) {
        setOverview(a);
        setBookings(b.items);
      }
    } catch (e) {
      if (!signal?.aborted) {
        if (!silent) setError((e as Error).message);
        else setLiveState("Update failed · manual refresh available");
      }
    } finally {
      inFlight.current = false;
      if (!signal?.aborted) setRefreshing(false);
    }
  }
  useEffect(() => {
    if (!authenticated) return;
    const abort = new AbortController();
    mainAbort.current = abort;
    const poller = createAdminPoller({
      allowed: () => {
        if (document.visibilityState !== "visible") {
          setLiveState("Tab hidden · updates paused");
          return false;
        }
        if (!navigator.onLine) {
          setLiveState("Offline · updates paused");
          return false;
        }
        if (adminInteractionActive()) {
          setLiveState("Editing or dialog open · updates paused");
          return false;
        }
        return !inFlight.current;
      },
      task: async (signal) => {
        const data = await fetchBookingFeed(
          (path) => adminRequest(path, "GET", undefined, signal),
          storage.get("efb-admin-bookings-seen"),
          () => storage.remove("efb-admin-bookings-seen"),
        );
        if (signal.aborted || abort.signal.aborted) return;
        const delta = bookingAlerts(checkpoint.current, data);
        checkpoint.current = delta.checkpoint;
        storage.set("efb-admin-alerts-v1", JSON.stringify(delta.checkpoint));
        setFeed(data);
        setLiveState("Updated " + bdDate(data.server_time) + " · BDT");
        if (delta.count) {
          setToast(
            delta.count === 1
              ? "A new booking has arrived."
              : `${delta.count} new bookings have arrived.`,
          );
          if (
            "Notification" in window &&
            navigator.onLine &&
            document.visibilityState === "visible" &&
            window.isSecureContext &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("ElectroFix BD · new booking", {
                body:
                  delta.count === 1
                    ? delta.fresh[0]?.booking_number ||
                      "A new service request is available in Admin."
                    : `${delta.count} new requests. Open Admin to review.`,
                tag: "efb-admin-new-booking",
              });
            } catch {
              /* In-app notice remains available. */
            }
          }
        }
        if (lastChange.current !== data.change_token) {
          lastChange.current = data.change_token;
          await load(true, signal);
          if (!signal.aborted)
            window.dispatchEvent(new Event("admin-data-updated"));
        }
      },
      onError: () =>
        setLiveState(
          navigator.onLine
            ? "Update failed · retrying when safe"
            : "Offline · updates paused",
        ),
    });
    poll.current = poller.tick;
    void load(false, abort.signal).then(() => poller.tick());
    const resume = () => {
      if (!navigator.onLine) setLiveState("Offline · updates paused");
      else if (document.visibilityState !== "visible")
        setLiveState("Tab hidden · updates paused");
      else {
        setLiveState("Waiting for a safe refresh…");
        void poller.tick();
      }
    };
    const storageChange = (e: StorageEvent) => {
      if (e.key === "efb-admin-alerts-v1")
        checkpoint.current = readCheckpoint(e.newValue);
    };
    const saved = () => {
      lastChange.current = null;
    };
    for (const event of ["online", "offline", "focus"])
      window.addEventListener(event, resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("storage", storageChange);
    window.addEventListener("admin-operation-saved", saved);
    return () => {
      abort.abort();
      poller.stop();
      poll.current = null;
      for (const event of ["online", "offline", "focus"])
        window.removeEventListener(event, resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("storage", storageChange);
      window.removeEventListener("admin-operation-saved", saved);
    };
  }, [authenticated]);
  function navigate(next: Panel) {
    if (next !== panel && canLeaveAdmin()) {
      setPanel(next);
      setMenu(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminRequest("/login", "POST", { username, password });
      setPassword("");
      setAuthenticated(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!canLeaveAdmin()) return;
    try {
      await adminRequest("/logout", "POST", {});
      clearSession();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function manualRefresh() {
    if (!canLeaveAdmin()) return;
    lastChange.current = null;
    if (panel === "content" || panel === "settings")
      setRefreshVersion((v) => v + 1);
    void load().then(() => {
      window.dispatchEvent(new Event("admin-data-updated"));
      void poll.current?.();
    });
  }
  const className = "efb-admin" + (dark ? " efb-admin-dark" : "");
  if (checking)
    return (
      <div className={className + " efb-login-shell"}>
        <p role="status">Loading owner workspace…</p>
      </div>
    );
  if (!authenticated || action)
    return (
      <div className={className + " efb-login-shell"}>
        <div className="efb-login-card">
          <div className="efb-login-mark">
            <Wrench size={24} />
          </div>
          <p className="efb-eyebrow">ElectroFix BD / Owner workspace</p>
          {recovering || action ? (
            <RecoveryPanel
              action={action}
              onBack={() => {
                if (canLeaveAdmin()) {
                  setRecovering(false);
                  setAction(null);
                  clearSession();
                }
              }}
            />
          ) : (
            <>
              <h1>Welcome back.</h1>
              <p className="efb-muted">
                Sign in to manage your business and website.
              </p>
              <form className="space-y-4 mt-6" onSubmit={login}>
                <label className="block">
                  Username
                  <input
                    required
                    maxLength={150}
                    autoComplete="username"
                    className={ui.field}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
                <label className="block">
                  Password
                  <input
                    required
                    type="password"
                    maxLength={1024}
                    autoComplete="current-password"
                    className={ui.field}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <Feedback error={error} />
                <button className={ui.primary + " w-full"} disabled={busy}>
                  {busy ? "Signing in…" : "Secure sign in"}
                </button>
              </form>
              <button
                className="efb-text-button mt-4"
                onClick={() => setRecovering(true)}
              >
                Forgot password?
              </button>
              <p className="efb-muted mt-6">
                Protected access for one trusted owner.
              </p>
            </>
          )}
        </div>
      </div>
    );
  const active = tabs.find((t) => t.key === panel)!;
  const navigation = (
    <nav aria-label="Admin workspace" className="efb-sidebar-nav">
      {tabs.map(({ key, label, Icon }) => (
        <button
          key={key}
          aria-current={panel === key ? "page" : undefined}
          onClick={() => navigate(key)}
        >
          <Icon size={19} />
          {label}
          {key === "bookings" && Boolean(feed?.unread) && (
            <span className="efb-nav-count" aria-hidden="true">
              {Math.min(feed!.unread, 999)}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
  return (
    <div className={className + " efb-admin-shell"}>
      <aside className="efb-sidebar">
        <div className="efb-sidebar-brand">
          <Wrench size={23} />
          <div>
            <strong>ElectroFix BD</strong>
            <small>Owner workspace</small>
          </div>
        </div>
        {navigation}
        <div className="efb-sidebar-bottom">
          <p>Secure business workspace</p>
          <button onClick={() => void logout()}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
      <div className="efb-main-column">
        <header className="efb-topbar">
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="efb-icon-button lg:hidden"
              aria-label="Open menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <div className="min-w-0">
              <p className="efb-muted text-xs">Workspace</p>
              <strong className="block truncate">{active.label}</strong>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              className="efb-icon-button"
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="efb-icon-button relative"
              aria-label={
                "Booking notifications" +
                (feed ? `, ${feed.unread} unread` : "")
              }
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {Boolean(feed?.unread) && (
                <span className="efb-notification-dot" />
              )}
            </button>
            <button
              className="efb-icon-button"
              aria-label="Refresh dashboard"
              disabled={refreshing}
              onClick={manualRefresh}
            >
              <RefreshCw
                size={19}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </header>
        <main className="efb-main">
          <div className="efb-workspace-meta">
            <BangladeshClock />
            <p className="efb-live-status">{liveState} · 20s refresh</p>
          </div>
          <div className="efb-page-heading">
            <div>
              <p className="efb-eyebrow">Business control center</p>
              <h1>
                {panel === "overview" ? "Business overview" : active.label}
              </h1>
              <p className="efb-muted">
                {panel === "overview"
                  ? "A clear view of your day, in Bangladesh time."
                  : panel === "bookings"
                    ? "Review requests and keep every next step clear."
                    : panel === "contacts"
                      ? "A focused inbox for customer follow-ups."
                      : panel === "settings"
                        ? "Account security, branding and approved integrations."
                        : "Review drafts and publish changes deliberately."}
              </p>
            </div>
          </div>
          <Feedback error={error} />
          {toast && (
            <div className="efb-booking-toast" role="status">
              <Bell size={18} />
              <span>{toast}</span>
              <button
                className="efb-text-button"
                onClick={() => {
                  navigate("bookings");
                  setToast("");
                }}
              >
                Review
              </button>
              <button
                className="efb-icon-button"
                aria-label="Dismiss booking notice"
                onClick={() => setToast("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {panel === "overview" && (
            <Dashboard
              overview={overview}
              bookings={bookings}
              onBookings={() => navigate("bookings")}
              onMessages={() => navigate("contacts")}
            />
          )}
          {panel === "bookings" && (
            <OperationsPanel key="bookings" kind="bookings" />
          )}
          {panel === "contacts" && (
            <OperationsPanel key="contacts" kind="contacts" />
          )}
          <Suspense
            fallback={
              <p role="status" className="efb-muted">
                Loading workspace…
              </p>
            }
          >
            {panel === "content" && <ContentEditor key={refreshVersion} />}
            {panel === "settings" && (
              <SettingsPanel key={refreshVersion} onLogout={clearSession} />
            )}
          </Suspense>
        </main>
      </div>
      <nav className="efb-mobile-nav" aria-label="Mobile admin navigation">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            aria-current={panel === key ? "page" : undefined}
            onClick={() => navigate(key)}
          >
            <Icon size={19} />
            <span>{key === "content" ? "Content" : label}</span>
          </button>
        ))}
      </nav>
      {menu && (
        <AdminDialog title="Workspace" onClose={() => setMenu(false)}>
          {navigation}
          <button className={ui.button} onClick={() => void logout()}>
            <LogOut size={18} />
            Sign out
          </button>
        </AdminDialog>
      )}
      {notifications && (
        <AdminDialog
          title="Booking notifications"
          onClose={() => setNotifications(false)}
        >
          <p className="efb-muted">
            {feed?.unread ?? 0} unread · Read state:{" "}
            {feed?.read_state === "shared-owner"
              ? "shared across owner devices"
              : "this browser until approved upgrade storage is enabled"}
            .
          </p>
          <p className="efb-muted">
            Alerts work while this Admin tab is open, online and safe to
            refresh. Browser-closed delivery requires a separately reviewed Web
            Push service.
          </p>
          <button
            className={ui.button}
            disabled={
              permission === "granted" ||
              permission === "denied" ||
              permission === "unavailable" ||
              !window.isSecureContext
            }
            onClick={async () => {
              if ("Notification" in window && window.isSecureContext) {
                try {
                  setPermission(await Notification.requestPermission());
                } catch {
                  setPermission("unavailable");
                }
              }
            }}
          >
            Enable browser notifications
          </button>
          <p className="efb-muted">
            Browser permission: {permission}. HTTPS or localhost required;
            browser/OS delivery is not guaranteed.
          </p>
          <div className="efb-notification-list">
            {feed?.items.map((item) => (
              <div key={item.booking_number}>
                <strong>{item.booking_number}</strong>
                <time>{bdDate(item.created_at)}</time>
              </div>
            ))}
            {!feed?.items.length && <p>No booking notifications yet.</p>}
          </div>
          <button
            className={ui.primary}
            disabled={!feed?.latest_cursor}
            onClick={async () => {
              try {
                const result = await adminRequest("/updates/seen", "POST", {
                  cursor: feed!.latest_cursor,
                });
                storage.set("efb-admin-bookings-seen", feed!.latest_cursor!);
                setFeed((prev) =>
                  prev ? { ...prev, unread: result.unread } : prev,
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Check size={16} />
            Mark current bookings seen
          </button>
        </AdminDialog>
      )}
    </div>
  );
}
