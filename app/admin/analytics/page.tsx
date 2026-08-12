"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminGuard, { useAdminBase } from "@/components/AdminGuard";
import { supabase } from "@/lib/supabase";

interface Slice { name: string; n: number; }
interface Week {
  week: string;
  opened: number;
  closed: number;
  resolved: number;
  by_category: Slice[];
}
interface Stats {
  open_now: number;
  need_action: number;
  created_7d: number;
  created_30d: number;
  avg_first_response_min: number | null;
  avg_resolution_h: number | null;
  by_category: Slice[];
  by_app: Slice[];
}

function fmtMinutes(min: number | null): string {
  if (min === null || isNaN(min)) return "—";
  if (min < 60) return `${min}m`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.floor(min / 1440)}g ${Math.floor((min % 1440) / 60)}h`;
}

function Bars({ title, data }: { title: string; data: Slice[] }) {
  const max = Math.max(...data.map((d) => d.n), 1);
  return (
    <div className="side-card">
      <p className="side-title">{title}</p>
      {data.length === 0 && <p className="sub" style={{ margin: 0 }}>Nessun dato.</p>}
      {data.map((d) => (
        <div key={d.name} className="bar-row">
          <span className="bar-label">{d.name}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(d.n / max) * 100}%` }} />
          </span>
          <span className="bar-n">{d.n}</span>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);

  useEffect(() => {
    supabase().rpc("get_support_stats").then(({ data }) => setStats(data as Stats));
    supabase().rpc("get_weekly_stats", { p_weeks: 8 })
      .then(({ data }) => setWeeks((data as Week[]) ?? []));
  }, []);

  if (!stats) return <div className="center sub">Calcolo le statistiche…</div>;

  return (
    <>
      <div className="stat-grid">
        <div className={`stat-card${stats.need_action > 0 ? " hot" : ""}`}>
          <span className="stat-when">adesso</span>
          <b>{stats.need_action}</b><span>da gestire</span>
        </div>
        <div className="stat-card">
          <span className="stat-when">adesso</span>
          <b>{stats.open_now}</b><span>richieste aperte</span>
        </div>
        <div className="stat-card">
          <span className="stat-when">ultimi 7 giorni</span>
          <b>{stats.created_7d}</b><span>nuove richieste</span>
        </div>
        <div className="stat-card">
          <span className="stat-when">ultimi 30 giorni</span>
          <b>{stats.created_30d}</b><span>nuove richieste</span>
        </div>
        <div className="stat-card">
          <span className="stat-when">ultimi 30 giorni</span>
          <b>{fmtMinutes(stats.avg_first_response_min)}</b><span>prima risposta media</span>
        </div>
        <div className="stat-card">
          <span className="stat-when">ultimi 30 giorni</span>
          <b>{stats.avg_resolution_h === null ? "—" : fmtMinutes(stats.avg_resolution_h * 60)}</b>
          <span>risoluzione media</span>
        </div>
      </div>

      {weeks.length > 0 && (
        <div className="side-card">
          <p className="side-title">Aperture per settimana · ultime {weeks.length} settimane ISO</p>
          <div className="trend">
            {[...weeks].reverse().map((w) => {
              const max = Math.max(...weeks.map((x) => x.opened), 1);
              return (
                <div key={w.week} className="trend-col" title={`${w.week}: ${w.opened} aperti`}>
                  <span className="trend-n">{w.opened > 0 ? w.opened : ""}</span>
                  <span className="trend-bar"
                    style={{ height: `${Math.max((w.opened / max) * 100, 3)}%` }} />
                  <span className="trend-label">{w.week.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="analytics-grid">
        <Bars title="Per categoria · ultimi 30 giorni" data={stats.by_category} />
        {stats.by_app.length > 1 && (
          <Bars title="Per app · ultimi 30 giorni" data={stats.by_app} />
        )}
      </div>
      <div className="side-card" style={{ marginTop: 12 }}>
        <p className="side-title">Recap settimanale · settimane ISO</p>
        <table className="wtable">
          <thead>
            <tr>
              <th>Settimana</th><th>Aperti</th><th>Risolti</th><th>Chiusi</th>
              <th className="wcats">Categorie (aperti)</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week}>
                <td className="wweek">{w.week}</td>
                <td><b>{w.opened}</b></td>
                <td>{w.resolved}</td>
                <td>{w.closed}</td>
                <td className="wcats">
                  {w.by_category.length === 0
                    ? "—"
                    : w.by_category.slice(0, 3).map((c) => `${c.name} ×${c.n}`).join(" · ")
                      + (w.by_category.length > 3 ? " · …" : "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="sub">
        Prima risposta e risoluzione sono medie sugli ultimi 30 giorni.
        Nel recap, aperti/risolti/chiusi contano gli eventi avvenuti in quella settimana.
      </p>
    </>
  );
}

export default function AnalyticsPage() {
  const base = useAdminBase();
  const router = useRouter();
  return (
    <AdminGuard>
      {(role) => (
        <main className="admin-shell">
          <header className="admin-top">
            <img src="/loghi/amia-logo.svg" alt="Amia" style={{ height: 30 }} />
            <nav className="admin-nav">
              <Link href={`${base}/inbox`}>Inbox</Link>
              <Link className="active" href={`${base}/analytics`}>Analytics</Link>
              {role === "admin" && <Link href={`${base}/settings`}>Impostazioni</Link>}
              <a href="#" onClick={async (e) => {
                e.preventDefault();
                await supabase().auth.signOut();
                router.replace(base);
              }}>Esci</a>
            </nav>
          </header>
          <Analytics />
        </main>
      )}
    </AdminGuard>
  );
}