import React, { useEffect, useState } from "react";
import { Activity, ArrowRight, Bell, CalendarDays, Check, ChevronRight, CircleHelp, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, MessageSquare, Monitor, RefreshCw, ShieldCheck, Smartphone, Sparkles, Star, Wrench, X } from "lucide-react";

type Panel = "overview" | "bookings" | "contacts" | "content" | "settings";
type Booking = { booking_number: string; customer_name: string; phone: string; address: string; service_name: string; status: string; notes?: string; created_at: string };
type Contact = { id: string; name: string; phone: string; message: string; status: string; created_at: string };
type Overview = { bookings: { total: number; pending: number }; contacts: { total: number; unread: number }; services: number; works: number; testimonials: number };
const tabs: { key: Panel; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard }, { key: "bookings", label: "Bookings", icon: ClipboardList }, { key: "contacts", label: "Messages", icon: MessageSquare }, { key: "content", label: "Website Content", icon: FileText }, { key: "settings", label: "Settings", icon: ShieldCheck }
];
const styles = { card: "rounded-2xl border border-slate-200/80 bg-white shadow-sm", button: "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-50", field: "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" };
async function request(path: string, init?: RequestInit) {
  const resp = await fetch("/api/admin" + path, { credentials: "same-origin", cache: "no-store", ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.method && init.method !== "GET" ? { "X-Admin-Request": "1" } : {}), ...init?.headers } });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || "Unable to complete request.");
  return body;
}
const formatDate = (s: string) => new Date(s).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
const statusColor = (status: string) => status === "completed" || status === "replied" ? "bg-emerald-50 text-emerald-700" : status === "pending" || status === "new" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700";
export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>("overview");
  const [drawer, setDrawer] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { request("/me").then(() => setAuthenticated(true)).catch(() => setAuthenticated(false)).finally(() => setChecking(false)); }, []);
  async function load() {
    setRefreshing(true); setError("");
    try {
      const [a, b, c] = await Promise.all([request("/overview"), request("/bookings"), request("/contacts")]);
      setOverview(a); setBookings(b.items); setContacts(c.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load dashboard."); }
    finally { setRefreshing(false); }
  }
  useEffect(() => { if (authenticated) void load(); }, [authenticated]);
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await request("/login", { method: "POST", body: JSON.stringify({ username, password }) }); setPassword(""); setAuthenticated(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Login failed."); }
    finally { setBusy(false); }
  }
  async function logout() { try { await request("/logout", { method: "POST", body: "{}" }); } finally { setAuthenticated(false); setOverview(null); } }
  async function changeStatus(kind: "bookings" | "contacts", id: string, status: string) {
    setError("");
    try { await request("/" + kind + "/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status }) }); if(kind === "bookings") setBookings(prev=>prev.map(item=>item.booking_number===id ? {...item,status} : item)); else setContacts(prev=>prev.map(item=>item.id===id ? {...item,status} : item)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update."); }
  }
  if (checking) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500"><RefreshCw className="mr-2 animate-spin" size={18} />Loading admin portal...</div>;
  if (!authenticated) return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090f23] px-5 py-12 text-slate-900">
    <div className="pointer-events-none absolute -top-36 -left-28 h-[450px] w-[450px] rounded-full bg-indigo-600/25 blur-3xl"/><div className="pointer-events-none absolute -bottom-36 -right-28 h-[450px] w-[450px] rounded-full bg-sky-500/20 blur-3xl"/>
    <div className="relative w-full max-w-md rounded-[30px] border border-white/20 bg-white p-7 shadow-2xl sm:p-10">
      <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><Wrench size={25}/></div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[.22em] text-indigo-600">ElectroFix BD / Control Center</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back.</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to manage your business, customers and content from one place.</p>
      <form onSubmit={login} className="mt-8 space-y-4">
        <label className="block text-sm font-semibold">Username<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className={styles.field+" mt-2"} placeholder="Admin username"/></label>
        <label className="block text-sm font-semibold">Password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className={styles.field+" mt-2"} placeholder="Enter your password"/></label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className={styles.button+" mt-2 w-full py-3.5"}>{busy ? "Signing in..." : "Secure sign in →"}</button>
      </form>
      <p className="mt-7 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-600"/> Protected administrative access</p>
    </div>
  </div>;
  const active = tabs.find(t=>t.key===panel)!;
  return <div className="min-h-screen bg-[#f4f6fb] font-sans text-slate-900">
    <div className="lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-[270px] transform border-r border-slate-200 bg-[#0d1730] text-slate-100 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${drawer ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-500 p-2.5"><Wrench size={20}/></div><div><strong className="block text-base leading-5">ElectroFix BD</strong><span className="text-xs text-indigo-200">Business control center</span></div></div><button className="lg:hidden" onClick={()=>setDrawer(false)} aria-label="Close menu"><X size={20}/></button></div>
        <div className="px-4 pt-7"><span className="px-3 text-[10px] font-bold uppercase tracking-[.25em] text-slate-400">Workspace</span><nav className="mt-3 space-y-1.5">{tabs.map(tab=><button key={tab.key} onClick={()=>{setPanel(tab.key);setDrawer(false)}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${panel===tab.key?"bg-indigo-500 text-white shadow-lg shadow-indigo-900/30":"text-slate-300 hover:bg-white/10 hover:text-white"}`}><tab.icon size={18}/>{tab.label}{panel===tab.key&&<ChevronRight size={15} className="ml-auto"/>}</button>)}</nav></div>
        <div className="absolute bottom-5 left-4 right-4"><div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><Activity size={15}/> Administrator online</div><p className="mt-1 text-xs leading-5 text-slate-400">Secure business workspace</p></div><button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10" onClick={()=>void logout()}><LogOut size={18}/> Sign out</button></div>
      </aside>
      {drawer && <button aria-label="Dismiss menu" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={()=>setDrawer(false)}/>}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-8"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={()=>setDrawer(true)} aria-label="Open menu"><Menu/></button><div><div className="text-xs text-slate-400">Workspace / {active.label}</div><div className="font-bold tracking-tight">{active.label}</div></div></div><div className="flex items-center gap-3"><button onClick={()=>void load()} aria-label="Refresh dashboard" disabled={refreshing} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"><RefreshCw size={18} className={refreshing?"animate-spin":""}/></button><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700">AD</div></div></header>
        <main className="mx-auto max-w-7xl px-4 py-7 pb-28 sm:px-8 sm:py-10 lg:pb-10">
          {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">ElectroFix BD / Admin</p><h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{panel==="overview"?"Good to see you again 👋":active.label}</h1><p className="mt-2 text-sm text-slate-500">{panel==="overview"?"Here’s your business at a glance.":"Stay in control from desktop or mobile."}</p></div><div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500">{new Date().toLocaleDateString("en-BD",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</div></div>
          {panel==="overview"&&<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
            {label:"Total bookings",value:overview?.bookings.total,meta:(overview?.bookings.pending||0)+" awaiting action",icon:ClipboardList,theme:"bg-indigo-100 text-indigo-600"},
            {label:"Customer messages",value:overview?.contacts.total,meta:(overview?.contacts.unread||0)+" unread messages",icon:MessageSquare,theme:"bg-amber-100 text-amber-600"},
            {label:"Active services",value:overview?.services,meta:"Services available",icon:Wrench,theme:"bg-emerald-100 text-emerald-600"},
            {label:"Portfolio & reviews",value:(overview?.works||0)+(overview?.testimonials||0),meta:"Works and testimonials",icon:Star,theme:"bg-sky-100 text-sky-600"}
          ].map(card=><div key={card.label} className={styles.card+" p-5 sm:p-6"}><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-500">{card.label}</span><div className={"rounded-xl p-2.5 "+card.theme}><card.icon size={20}/></div></div><div className="mt-4 text-3xl font-black tracking-tight">{card.value??"—"}</div><p className="mt-2 text-xs text-slate-500">{card.meta}</p></div>)}</div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><section className={styles.card+" overflow-hidden"}><div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6"><div><h2 className="text-lg font-bold">Recent bookings</h2><p className="mt-1 text-xs text-slate-500">Latest customer requests</p></div><button className="text-sm font-semibold text-indigo-600" onClick={()=>setPanel("bookings")}>View all <ArrowRight className="inline" size={15}/></button></div><div className="divide-y divide-slate-100">{bookings.slice(0,5).map(b=><div key={b.booking_number} className="flex items-center justify-between gap-3 p-4 sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-bold">{b.customer_name}</p><p className="mt-1 truncate text-xs text-slate-500">{b.service_name} • {b.booking_number}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold capitalize "+statusColor(b.status)}>{b.status.replaceAll("_"," ")}</span></div>)}{!bookings.length&&<p className="p-6 text-sm text-slate-500">No bookings yet.</p>}</div></section><section className={styles.card+" p-6"}><div className="mb-5 inline-flex rounded-xl bg-indigo-100 p-3 text-indigo-600"><Sparkles size={22}/></div><h2 className="text-xl font-extrabold">Your command center</h2><p className="mt-2 text-sm leading-6 text-slate-500">Track customer requests and keep your operations moving. Content editing modules will join this workspace in the next milestone.</p><button onClick={()=>setPanel("contacts")} className={styles.button+" mt-6 w-full"}>Open customer inbox <ArrowRight className="ml-1 inline" size={16}/></button></section></div></>}
          {panel==="bookings"&&<div className={styles.card+" overflow-hidden"}><div className="border-b border-slate-100 p-5 sm:p-6"><h2 className="text-lg font-bold">Manage bookings</h2><p className="mt-1 text-sm text-slate-500">Update customer service progress with one tap.</p></div><div className="divide-y divide-slate-100">{bookings.map(b=><article key={b.booking_number} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{b.customer_name}</h3><p className="mt-1 break-all text-xs text-slate-500">{b.booking_number} • {formatDate(b.created_at)}</p><p className="mt-2 text-sm font-semibold text-indigo-600">{b.service_name}</p></div><span className={"rounded-full px-3 py-1 text-xs font-bold capitalize "+statusColor(b.status)}>{b.status.replaceAll("_"," ")}</span></div><div className="mt-3 space-y-1 text-sm text-slate-600"><p>Phone: <a className="font-semibold text-indigo-700" href={"tel:"+b.phone}>{b.phone}</a></p><p>{b.address}</p>{b.notes&&<p className="text-slate-500">Note: {b.notes}</p>}</div><label className="mt-4 block text-xs font-semibold text-slate-500">Booking status<select className={styles.field+" mt-2 max-w-sm"} value={b.status} onChange={e=>void changeStatus("bookings",b.booking_number,e.target.value)}>{["pending","contacted","confirmed","completed","cancelled"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label></article>)}{!bookings.length&&<p className="p-6 text-sm text-slate-500">No bookings found.</p>}</div><div className="border-t border-slate-100 p-4 text-xs text-slate-400">Showing up to 30 most recent bookings.</div></div>}
          {panel==="contacts"&&<div className={styles.card+" overflow-hidden"}><div className="border-b border-slate-100 p-5 sm:p-6"><h2 className="text-lg font-bold">Customer inbox</h2><p className="mt-1 text-sm text-slate-500">Read and organize incoming inquiries.</p></div><div className="divide-y divide-slate-100">{contacts.map(c=><article key={c.id} className="p-5 sm:p-6"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">{c.name}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(c.created_at)} · <a href={"tel:"+c.phone} className="text-indigo-600">{c.phone}</a></p></div><span className={"rounded-full px-3 py-1 text-xs font-bold capitalize "+statusColor(c.status)}>{c.status}</span></div><p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{c.message}</p><label className="mt-4 block text-xs font-semibold text-slate-500">Message status<select className={styles.field+" mt-2 max-w-sm"} value={c.status} onChange={e=>void changeStatus("contacts",c.id,e.target.value)}>{["new","read","replied"].map(s=><option key={s}>{s}</option>)}</select></label></article>)}{!contacts.length&&<p className="p-6 text-sm text-slate-500">No messages found.</p>}</div><div className="border-t border-slate-100 p-4 text-xs text-slate-400">Showing up to 30 newest messages.</div></div>}
          {panel==="content"&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[{name:"Services",icon:Wrench,desc:"Manage service titles, descriptions, coverage and imagery."},{name:"Portfolio",icon:Monitor,desc:"Publish your completed work and project showcases."},{name:"Reviews",icon:Star,desc:"Moderate customer testimonials and ratings."},{name:"Website Settings",icon:Smartphone,desc:"Update contact information, banners, FAQs and page content."}].map(item=><div className={styles.card+" p-6"} key={item.name}><div className="mb-5 inline-flex rounded-xl bg-indigo-100 p-3 text-indigo-700"><item.icon size={22}/></div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p><p className="mt-5 text-xs font-bold uppercase tracking-wider text-amber-600">Next milestone · Not yet editable</p></div>)}</div>}
          {panel==="settings"&&<div className={styles.card+" max-w-2xl p-6"}><ShieldCheck className="text-emerald-600" size={30}/><h2 className="mt-4 text-xl font-bold">Admin security</h2><p className="mt-2 text-sm leading-6 text-slate-500">Your session is protected by an HttpOnly cookie. Credentials are configured on the server, never stored in browser storage. Additional role-based access and activity auditing are planned.</p><button onClick={()=>void logout()} className={styles.button+" mt-6"}>Sign out securely</button></div>}
        </main>
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-lg backdrop-blur lg:hidden">{tabs.slice(0,4).map(t=><button key={t.key} onClick={()=>setPanel(t.key)} className={"flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold "+(panel===t.key?"bg-indigo-50 text-indigo-700":"text-slate-500")}><t.icon size={19}/><span className="truncate">{t.label==="Website Content"?"Content":t.label}</span></button>)}</div>
  </div>;
}
