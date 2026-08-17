"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminGuard, {
  ADMIN_STATUS_LABEL, PRIORITY_COLOR, Priority, timeAgo, useAdminBase,
} from "@/components/AdminGuard";
import { supabase, TicketStatus } from "@/lib/supabase";

interface Row {
  id: number;
  title: string;
  status: TicketStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  app_id: string;
  category_id: string | null;
  locked_by: string | null;
  categories: { name: string } | null;
  apps: { name: string; slug: string } | null;
  profiles: { email: string } | null;
}

/** Retention allegati (v2, via Storage API):
 *  la RPC elenca gli scaduti, il client cancella file e poi righe. */
async function purgeOldAttachments() {
  const { data } = await supabase().rpc("purgeable_attachments");
  const items = (data ?? []) as { id: string; storage_path: string }[];
  if (items.length === 0) return;
  const { error: rmErr } = await supabase()
    .storage.from("attachments")
    .remove(items.map((i) => i.storage_path));
  if (rmErr) return; // file non cancellati -> righe intatte, riprova al giro dopo
  await supabase().from("attachments").delete().in("id", items.map((i) => i.id));
}

/** Peso di urgenza: cosa richiede l'operatore prima. */
const URGENCY: Record<TicketStatus, number> = {
  nuovo: 0, da_rispondere: 0, in_attesa_dev: 1, in_lavorazione: 2, chiuso: 3,
};

function Inbox() {
  const base = useAdminBase();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<string>("");
  const [showClosed, setShowClosed] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"" | TicketStatus>("");
  const [filterCat, setFilterCat] = useState("");
  const [filterApp, setFilterApp] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string; app_id: string }[]>([]);
  const [appList, setAppList] = useState<{ id: string; name: string }[]>([]);
  const [sort, setSort] = useState<"coda" | "urgenza" | "aggiornati">("coda");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    // manutenzioni senza cron: lock orfani + auto-chiusura 7gg
    await Promise.allSettled([
      supabase().rpc("release_stale_tickets"),
      supabase().rpc("close_stale_answered"),
      purgeOldAttachments(),                     // retention: allegati chiusi >30gg
    ]);
    const [{ data }, { data: c }, { data: a }] = await Promise.all([
      supabase()
        .from("tickets")
        .select("id, title, status, priority, created_at, updated_at, locked_by, app_id, category_id, categories(name), apps(name, slug), profiles!tickets_user_id_fkey(email)")
        .order("updated_at", { ascending: false }),
      supabase().from("categories").select("id, name, app_id").order("name"),
      supabase().from("apps").select("id, name").order("name"),
    ]);
    setRows((data as unknown as Row[]) ?? []);
    setCats((c as { id: string; name: string; app_id: string }[]) ?? []);
    setAppList((a as { id: string; name: string }[]) ?? []);
  }, []);

  useEffect(() => {
    supabase().auth.getUser().then(({ data }) => setMe(data.user?.id ?? ""));
    load();
    let t: ReturnType<typeof setInterval> | null = setInterval(load, 15000);
    const onVisibility = () => {
      if (document.hidden) {
        if (t) { clearInterval(t); t = null; }
      } else if (!t) {
        load();
        t = setInterval(load, 15000);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (t) clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  if (rows === null)
    return <div className="center sub">Carico l&apos;inbox…</div>;

  const needle = q.trim().toLowerCase();
  const visible = rows
    .filter((r) => (showClosed ? true : r.status !== "chiuso"))
    .filter((r) => (filterStatus ? r.status === filterStatus : true))
    .filter((r) => (filterCat ? r.category_id === filterCat : true))
    .filter((r) => (filterApp ? r.app_id === filterApp : true))
    .filter((r) =>
      needle
        ? r.title.toLowerCase().includes(needle) ||
          (r.profiles?.email ?? "").toLowerCase().includes(needle) ||
          `#${r.id}`.includes(needle) || String(r.id) === needle
        : true)
    .sort((a, b) => {
      if (sort === "aggiornati") return +new Date(b.updated_at) - +new Date(a.updated_at);
      if (sort === "urgenza")
        return URGENCY[a.status] - URGENCY[b.status] ||
          +new Date(a.created_at) - +new Date(b.created_at);
      // default "coda": pura data di apertura, i piu' vecchi in cima
      // (aprire/guardare un ticket non lo rimescola mai)
      return +new Date(a.created_at) - +new Date(b.created_at);
    });

  const needAction = rows.filter((r) => URGENCY[r.status] === 0).length;

  return (
    <>
      <div className="admin-filters">
        <span className="sub" style={{ margin: 0 }}>
          <b style={{ color: "var(--text)" }}>{needAction}</b> da gestire
        </span>
        <input className="field slim" style={{ minWidth: 180 }}
          placeholder="Cerca: titolo, email, #id…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field slim" value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TicketStatus | "")}>
          <option value="">Tutti gli stati</option>
          {Object.entries(ADMIN_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="field slim" value={filterApp}
          onChange={(e) => { setFilterApp(e.target.value); setFilterCat(""); }}>
          <option value="">Tutte le app</option>
          {appList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="field slim" value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {cats
            .filter((c) => !filterApp || c.app_id === filterApp)
            .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="field slim" value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="coda">Ordina: apertura (vecchi prima)</option>
          <option value="urgenza">Ordina: urgenza</option>
          <option value="aggiornati">Ordina: aggiornati di recente</option>
        </select>
        <label className="sub check" style={{ margin: 0 }}>
          <input type="checkbox" checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)} /> mostra chiusi
        </label>
      </div>

      {visible.length === 0 && (
        <div className="center sub" style={{ padding: 60 }}>Inbox vuota. 🟢 Tutto gestito.</div>
      )}

      {visible.map((r) => (
        <Link key={r.id} href={`${base}/tickets/${r.id}`}
          className={`trow${r.status === "chiuso" ? " closed" : ""}`}>
          <span className="prio-dot" style={{ background: PRIORITY_COLOR[r.priority] }}
            title={`Priorità ${r.priority}`} />
          <span className="tid">#{r.id}</span>
          <span className="tmain">
            <span className="ttitle">{r.title}</span>
            <span className="tmeta">
              {r.profiles?.email ?? "—"}
              {r.categories?.name ? ` · ${r.categories.name}` : ""}
              {r.apps?.name ? ` · ${r.apps.name}` : ""}
            </span>
          </span>
          {r.locked_by && r.locked_by !== me && (
            <span className="pill" title="Un altro operatore lo sta guardando">in visione</span>
          )}
          <span className={`pill s-${r.status}`}>{ADMIN_STATUS_LABEL[r.status]}</span>
          <span className="ttime">{timeAgo(r.updated_at)}</span>
        </Link>
      ))}
    </>
  );
}

export default function InboxPage() {
  const base = useAdminBase();
  const router = useRouter();
  return (
    <AdminGuard>
      {(role) => (
        <main className="admin-shell">
          <header className="admin-top">
            <img src="/loghi/amia-logo.svg" alt="Amia" style={{ height: 30 }} />
            <nav className="admin-nav">
              <Link className="active" href={`${base}/inbox`}>Inbox</Link>
              <Link href={`${base}/analytics`}>Analytics</Link>
              {role === "admin" && <Link href={`${base}/settings`}>Impostazioni</Link>}
              <a href="#" onClick={async (e) => {
                e.preventDefault();
                await supabase().auth.signOut();
                router.replace(base);
              }}>Esci</a>
            </nav>
          </header>
          <Inbox />
        </main>
      )}
    </AdminGuard>
  );
}