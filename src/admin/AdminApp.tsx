import React, { useEffect, useRef, useState } from "react";
import "./admin.css";
import OperationsPanel from "./OperationsPanel";
import SecurityPanel from "./SecurityPanel";
import { canLeaveAdmin } from "./ui";
import Analytics from "./Analytics";
import ContentEditor from "./ContentEditor";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Wrench,
  Moon,
  Sun,
  X,
} from "lucide-react";

type Panel = "overview" | "bookings" | "contacts" | "content" | "settings";
type Booking = {
  booking_number: string;
  customer_name: string;
  phone: string;
  address: string;
  service_name: string;
  status: string;
  notes?: string;
  created_at: string;
};
type Contact = {
  id: string;
  name: string;
  phone: string;
  message: string;
  status: string;
  created_at: string;
};
type Overview = {
  bookings: { total: number; pending: number };
  contacts: { total: number; unread: number };
  services: number;
  works: number;
  testimonials: number;
  days?: { day: string; bookings: number }[];
  statuses?: { status: string; total: number }[];
};
const tabs: {
  key: Panel;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "bookings", label: "Bookings", icon: ClipboardList },
  { key: "contacts", label: "Messages", icon: MessageSquare },
  { key: "content", label: "Website Content", icon: FileText },
  { key: "settings", label: "Settings", icon: ShieldCheck },
];
const styles = {
  card: "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
  button:
    "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-50",
  field:
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
};
async function request(path: string, init?: RequestInit) {
  const resp = await fetch("/api/admin" + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.method && init.method !== "GET"
        ? { "X-Admin-Request": "1" }
        : {}),
      ...init?.headers,
    },
  });
  const body = await resp.json().catch(() => ({}));
  if (resp.status === 401)
    window.dispatchEvent(new Event("admin-session-expired"));
  if (!resp.ok) throw new Error(body.error || "Unable to complete request.");
  return body;
}
const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const statusColor = (status: string) =>
  status === "completed" || status === "replied"
    ? "bg-emerald-50 text-emerald-700"
    : status === "pending" || status === "new"
      ? "bg-amber-50 text-amber-700"
      : "bg-indigo-50 text-indigo-700";
export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>("overview");
  function navigate(next: Panel) {
    if (next !== panel && canLeaveAdmin()) setPanel(next);
  }
  const [drawer, setDrawer] = useState(false);
  const [bdClock, setBdClock] = useState("");
  const [darkMode, setDarkMode] = useState(() => { try { return window.localStorage.getItem("efb-admin-theme") === "dark"; } catch { return false; } });
  useEffect(() => {
    const updateClock = () => setBdClock(new Intl.DateTimeFormat("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { try { window.localStorage.setItem("efb-admin-theme", darkMode ? "dark" : "light"); } catch { /* unavailable storage */ } }, [darkMode]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  function refreshView() {
    if (canLeaveAdmin()) {
      setRefreshVersion((v) => v + 1);
      void load();
    }
  }
  useEffect(() => {
    request("/me")
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);
  async function load(silent = false) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) {
      setRefreshing(true);
      setError("");
    }
    try {
      const [a, b, c] = await Promise.all([
        request("/overview"),
        request("/bookings"),
        request("/contacts"),
      ]);
      setOverview(a);
      setBookings(b.items);
      setContacts(c.items);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Unable to load dashboard.");
    } finally {
      refreshInFlight.current = false;
      if (!silent) setRefreshing(false);
    }
  }
  useEffect(() => {
    if (!authenticated) return;
    void load();
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void load(true);
    };
    const interval = window.setInterval(refreshVisibleData, 20_000);
    window.addEventListener("focus", refreshVisibleData);
    window.addEventListener("online", refreshVisibleData);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleData);
      window.removeEventListener("online", refreshVisibleData);
    };
  }, [authenticated]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setAuthenticated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!canLeaveAdmin()) return;
    try {
      await request("/logout", { method: "POST", body: "{}" });
      setAuthenticated(false);
      setOverview(null);
      setBookings([]);
      setContacts([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const expire = () => {
      setAuthenticated(false);
      setOverview(null);
      setBookings([]);
      setContacts([]);
    };
    window.addEventListener("admin-session-expired", expire);
    return () => window.removeEventListener("admin-session-expired", expire);
  }, []);
  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <RefreshCw className="mr-2 animate-spin" size={18} />
        Loading admin portal...
      </div>
    );
  if (!authenticated)
    return (
      <div className="efb-admin relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090f23] px-5 py-12 text-slate-900">
        <div className="pointer-events-none absolute -top-36 -left-28 h-[450px] w-[450px] rounded-full bg-[#004179]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -right-28 h-[450px] w-[450px] rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative w-full max-w-md rounded-[30px] border border-white/20 bg-white p-7 shadow-2xl sm:p-10">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <Wrench size={25} />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-indigo-600">
            ElectroFix BD / Control Center
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sign in to manage your business, customers and content from one
            place.
          </p>
          <form onSubmit={login} className="mt-8 space-y-4">
            <label className="block text-sm font-semibold">
              Username
              <input
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.field + " mt-2"}
                placeholder="Admin username"
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.field + " mt-2"}
                placeholder="Enter your password"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className={styles.button + " mt-2 w-full py-3.5"}
            >
              {busy ? "Signing in..." : "Secure sign in →"}
            </button>
          </form>
          <p className="mt-7 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={15} className="text-emerald-600" /> Protected
            administrative access
          </p>
        </div>
      </div>
    );
  const active = tabs.find((t) => t.key === panel)!;
  return (
    <div className={"efb-admin min-h-screen bg-[#F6F8FA] text-slate-900" + (darkMode ? " efb-admin-dark" : "")}>
      <div className="lg:flex">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[270px] transform border-r border-slate-200 bg-[#11243A] text-slate-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#004179] p-2.5">
                <Wrench size={20} />
              </div>
              <div>
                <strong className="block text-base leading-5">
                  ElectroFix BD
                </strong>
                <span className="text-xs text-indigo-200">
                  Business control center
                </span>
              </div>
            </div>
            <button
              className="lg:hidden"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
          <div className="px-4 pt-7">
            <span className="px-3 text-[10px] font-bold uppercase tracking-[.25em] text-slate-400">
              Workspace
            </span>
            <nav className="mt-3 space-y-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    navigate(tab.key);
                    setDrawer(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${panel === tab.key ? "bg-[#004179] text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                  {panel === tab.key && (
                    <ChevronRight size={15} className="ml-auto" />
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="absolute bottom-5 left-4 right-4">
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <Activity size={15} /> Administrator online
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Secure business workspace
              </p>
            </div>
            <button
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10"
              onClick={() => void logout()}
            >
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>
        {drawer && (
          <button
            aria-label="Dismiss menu"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setDrawer(false)}
          />
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
              >
                <Menu />
              </button>
              <div>
                <div className="text-xs text-slate-400">
                  Workspace / {active.label}
                </div>
                <div className="font-bold tracking-tight">{active.label}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div aria-label="Bangladesh time" title="Bangladesh time (Asia/Dhaka)" className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold tabular-nums text-slate-700 sm:block"><span className="mr-2 text-slate-400">BDT</span>{bdClock}</div>
              <button type="button" onClick={() => setDarkMode(v => !v)} aria-label={darkMode ? "Use light mode" : "Use dark mode"} title={darkMode ? "Light mode" : "Dark mode"} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
              <button
                onClick={refreshView}
                aria-label="Refresh dashboard"
                disabled={refreshing}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw
                  size={18}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700">
                AD
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-7 pb-28 sm:px-8 sm:py-10 lg:pb-10">
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              >
                {error}
              </div>
            )}
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
                  ElectroFix BD / Admin
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {panel === "overview" ? "Business overview" : active.label}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {panel === "overview"
                    ? "Here’s your business at a glance."
                    : "Stay in control from desktop or mobile."}
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500">
                {new Date().toLocaleDateString("en-BD", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            {panel === "overview" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Total bookings",
                      value: overview?.bookings.total,
                      meta:
                        (overview?.bookings.pending || 0) + " awaiting action",
                      icon: ClipboardList,
                      theme: "bg-indigo-100 text-indigo-600",
                    },
                    {
                      label: "Customer messages",
                      value: overview?.contacts.total,
                      meta:
                        (overview?.contacts.unread || 0) + " unread messages",
                      icon: MessageSquare,
                      theme: "bg-amber-100 text-amber-600",
                    },
                    {
                      label: "Active services",
                      value: overview?.services,
                      meta: "Services available",
                      icon: Wrench,
                      theme: "bg-emerald-100 text-emerald-600",
                    },
                    {
                      label: "Portfolio & reviews",
                      value:
                        (overview?.works || 0) + (overview?.testimonials || 0),
                      meta: "Works and testimonials",
                      icon: Star,
                      theme: "bg-sky-100 text-sky-600",
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className={styles.card + " p-5 sm:p-6"}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-500">
                          {card.label}
                        </span>
                        <div className={"rounded-xl p-2.5 " + card.theme}>
                          <card.icon size={20} />
                        </div>
                      </div>
                      <div className="mt-4 text-3xl font-black tracking-tight">
                        {card.value ?? "—"}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{card.meta}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                  <section className={styles.card + " overflow-hidden"}>
                    <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6">
                      <div>
                        <h2 className="text-lg font-bold">Recent bookings</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Latest customer requests
                        </p>
                      </div>
                      <button
                        className="text-sm font-semibold text-indigo-600"
                        onClick={() => navigate("bookings")}
                      >
                        View all <ArrowRight className="inline" size={15} />
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {bookings.slice(0, 5).map((b) => (
                        <div
                          key={b.booking_number}
                          className="flex items-center justify-between gap-3 p-4 sm:px-6"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {b.customer_name}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {b.service_name} • {b.booking_number}
                            </p>
                          </div>
                          <span
                            className={
                              "rounded-full px-3 py-1 text-xs font-bold capitalize " +
                              statusColor(b.status)
                            }
                          >
                            {b.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      ))}
                      {!bookings.length && (
                        <p className="p-6 text-sm text-slate-500">
                          No bookings yet.
                        </p>
                      )}
                    </div>
                  </section>
                  <section className={styles.card + " p-6"}>
                    <div className="mb-5 inline-flex rounded-xl bg-indigo-100 p-3 text-indigo-600">
                      <Sparkles size={22} />
                    </div>
                    <h2 className="text-xl font-extrabold">
                      Your command center
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Track customer requests and keep your operations moving.
                      Save and publish reviewed content, restore earlier
                      versions and manage customer requests from this workspace.
                    </p>
                    <button
                      onClick={() => navigate("contacts")}
                      className={styles.button + " mt-6 w-full"}
                    >
                      Open customer inbox{" "}
                      <ArrowRight className="ml-1 inline" size={16} />
                    </button>
                  </section>
                </div>
                <Analytics
                  days={overview?.days}
                  statuses={overview?.statuses}
                />
              </>
            )}
            {panel === "bookings" && (
              <OperationsPanel
                key={"bookings" + refreshVersion}
                kind="bookings"
              />
            )}
            {panel === "contacts" && (
              <OperationsPanel
                key={"contacts" + refreshVersion}
                kind="contacts"
              />
            )}
            {panel === "content" && <ContentEditor key={refreshVersion} />}
            {panel === "settings" && (
              <SecurityPanel
                key={refreshVersion}
                onLogout={() => {
                  setAuthenticated(false);
                  setOverview(null);
                  setBookings([]);
                  setContacts([]);
                }}
              />
            )}
          </main>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-lg backdrop-blur lg:hidden">
        {tabs.slice(0, 4).map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(t.key)}
            className={
              "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold " +
              (panel === t.key
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500")
            }
          >
            <t.icon size={19} />
            <span className="truncate">
              {t.label === "Website Content" ? "Content" : t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
