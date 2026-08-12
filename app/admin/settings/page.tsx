"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard, { useAdminBase } from "@/components/AdminGuard";
import { supabase } from "@/lib/supabase";

interface App { id: string; slug: string; name: string; jwt_issuer: string | null; jwt_audiences: string[]; discord_webhook_url: string | null; }
interface Cat { id: string; app_id: string; slug: string; name: string; faq_md: string | null; info_request_md: string | null; }

function Settings() {
  const [apps, setApps] = useState<App[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [appId, setAppId] = useState<string>("");
  const [editing, setEditing] = useState<Cat | null>(null);
  const [showNewApp, setShowNewApp] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase().from("apps").select("*").order("name"),
      supabase().from("categories").select("*").order("name"),
    ]);
    setApps((a as App[]) ?? []);
    setCats((c as Cat[]) ?? []);
    if (a?.length && !appId) setAppId(a[0].id);
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(""), 2500); }

  async function saveCat(c: Cat) {
    const { error } = c.id
      ? await supabase().from("categories")
          .update({ name: c.name, faq_md: c.faq_md || null, info_request_md: c.info_request_md || null })
          .eq("id", c.id)
      : await supabase().from("categories").insert({
          app_id: appId,
          slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40),
          name: c.name, faq_md: c.faq_md || null, info_request_md: c.info_request_md || null,
        });
    if (error) { flash("Errore: " + error.message); return; }
    setEditing(null); flash("Salvato.");
    load();
  }

  async function createApp(form: FormData) {
    const audiences = String(form.get("audiences") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase().from("apps").insert({
      name: String(form.get("name")),
      slug: String(form.get("slug")).toLowerCase().trim(),
      jwt_issuer: String(form.get("issuer")).trim() || null,
      jwt_audiences: audiences,
      discord_webhook_url: String(form.get("webhook")).trim() || null,
    });
    if (error) { flash("Errore: " + error.message); return; }
    setShowNewApp(false); flash("App registrata.");
    load();
  }

  const appCats = cats.filter((c) => c.app_id === appId);

  return (
    <>
      {msg && <p className="sub" style={{ color: "var(--accent)" }}>{msg}</p>}

      <div className="admin-filters">
        <select className="field slim" value={appId} onChange={(e) => setAppId(e.target.value)}>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="btn ghost slim-btn" onClick={() => setShowNewApp(!showNewApp)}>
          + App
        </button>
      </div>

      {showNewApp && (
        <form className="side-card" action={createApp}>
          <p className="side-title">Registra una nuova app</p>
          <input className="field slim" name="name" placeholder="Nome (es. Algo Basket)" required />
          <input className="field slim" name="slug" placeholder="Slug (es. algo-basket)" required />
          <input className="field slim" name="issuer" placeholder="JWT issuer (Cognito: https://cognito-idp.../pool-id)" />
          <input className="field slim" name="audiences" placeholder="App client ID (piu' valori: separati da virgola)" />
          <input className="field slim" name="webhook" placeholder="Discord webhook URL" />
          <button className="btn slim-btn">Registra</button>
        </form>
      )}

      <p className="section-label">Categorie</p>
      {appCats.map((c) => (
        <div key={c.id} className="side-card">
          {editing?.id === c.id ? (
            <CatForm cat={editing} onChange={setEditing} onSave={() => saveCat(editing)}
              onCancel={() => setEditing(null)} />
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <b>{c.name}</b>
                <p className="sub" style={{ margin: "4px 0 0" }}>
                  {c.faq_md ? "FAQ ✓" : "FAQ —"} · {c.info_request_md ? "checklist ✓" : "checklist —"}
                </p>
              </div>
              <button className="btn ghost slim-btn" onClick={() => setEditing(c)}>Modifica</button>
            </div>
          )}
        </div>
      ))}

      {editing && !editing.id && (
        <div className="side-card">
          <CatForm cat={editing} onChange={setEditing} onSave={() => saveCat(editing)}
            onCancel={() => setEditing(null)} />
        </div>
      )}
      {!editing && (
        <button className="btn ghost slim-btn"
          onClick={() => setEditing({ id: "", app_id: appId, slug: "", name: "", faq_md: "", info_request_md: "" })}>
          + Categoria
        </button>
      )}
    </>
  );
}

function CatForm({ cat, onChange, onSave, onCancel }: {
  cat: Cat; onChange: (c: Cat) => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input className="field slim" placeholder="Nome categoria"
        value={cat.name} onChange={(e) => onChange({ ...cat, name: e.target.value })} />
      <textarea className="field" rows={3}
        placeholder="Risposta FAQ del bot (markdown: **grassetto**) — vuoto = il bot non prova a risolvere"
        value={cat.faq_md ?? ""} onChange={(e) => onChange({ ...cat, faq_md: e.target.value })} />
      <textarea className="field" rows={3}
        placeholder={"Checklist informazioni (una per riga, con •)\n• email dell'account\n• screenshot"}
        value={cat.info_request_md ?? ""} onChange={(e) => onChange({ ...cat, info_request_md: e.target.value })} />
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn slim-btn" onClick={onSave} disabled={!cat.name.trim()}>Salva</button>
        <button className="btn ghost slim-btn" onClick={onCancel}>Annulla</button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const base = useAdminBase();
  return (
    <AdminGuard>
      {(role) =>
        role !== "admin" ? (
          <main className="admin-shell"><div className="center"><div>
            <h1>404</h1><p className="sub">Questa pagina non esiste.</p>
          </div></div></main>
        ) : (
          <main className="admin-shell">
            <header className="admin-top">
              <img src="/loghi/amia-white.svg" alt="Amia" style={{ height: 30 }} />
              <nav className="admin-nav">
                <Link href={`${base}/inbox`}>Inbox</Link>
                <Link href={`${base}/analytics`}>Analytics</Link>
                <Link className="active" href={`${base}/settings`}>Impostazioni</Link>
              </nav>
            </header>
            <Settings />
          </main>
        )
      }
    </AdminGuard>
  );
}