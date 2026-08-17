"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard, { useAdminBase } from "@/components/AdminGuard";
import { supabase } from "@/lib/supabase";

interface App { id: string; slug: string; name: string; jwt_issuer: string | null; jwt_audiences: string[]; discord_webhook_url: string | null; portal_host: string | null; brand_accent: string; from_email: string | null; logo_url: string | null; }
interface Cat { id: string; app_id: string; slug: string; name: string; faq_md: string | null; info_request_md: string | null; archived: boolean; sort_order: number; }

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

  async function toggleArchive(c: Cat) {
    const { error } = await supabase()
      .from("categories").update({ archived: !c.archived }).eq("id", c.id);
    if (error) { flash("Errore: " + error.message); return; }
    flash(c.archived ? "Categoria ripristinata." : "Categoria archiviata: non appare più nel portale.");
    load();
  }

  async function saveCat(c: Cat) {
    const { error } = c.id
      ? await supabase().from("categories")
          .update({ name: c.name, faq_md: c.faq_md || null, info_request_md: c.info_request_md || null, sort_order: c.sort_order || 100 })
          .eq("id", c.id)
      : await supabase().from("categories").insert({
          app_id: appId,
          slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40),
          name: c.name, faq_md: c.faq_md || null, info_request_md: c.info_request_md || null,
          archived: false, sort_order: c.sort_order || 100,
        });
    if (error) { flash("Errore: " + error.message); return; }
    setEditing(null); flash("Salvato.");
    load();
  }

  async function createApp(form: FormData) {
    const slug = String(form.get("slug")).toLowerCase().trim();
    const audiences = String(form.get("audiences") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);

    // logo: upload su Storage (bucket pubblico "branding") -> URL nel record
    let logoUrl: string | null = null;
    const logo = form.get("logo") as File | null;
    if (logo && logo.size > 0) {
      const ext = logo.name.split(".").pop() || "svg";
      const path = `${slug}/logo.${ext}`;
      const { error: upErr } = await supabase()
        .storage.from("branding").upload(path, logo, { upsert: true, contentType: logo.type });
      if (upErr) { flash("Errore upload logo: " + upErr.message); return; }
      logoUrl = supabase().storage.from("branding").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase().from("apps").insert({
      name: String(form.get("name")),
      slug,
      jwt_issuer: String(form.get("issuer")).trim() || null,
      jwt_audiences: audiences,
      discord_webhook_url: String(form.get("webhook")).trim() || null,
      portal_host: String(form.get("portal_host")).trim().toLowerCase() || null,
      brand_accent: String(form.get("accent") || "#35d07f"),
      from_email: String(form.get("from_email")).trim() || null,
      logo_url: logoUrl,
    });
    if (error) { flash("Errore: " + error.message); return; }
    setShowNewApp(false);
    flash("App registrata. Ricorda: CNAME del dominio verso Vercel + dominio nel progetto Vercel.");
    load();
  }

  const appCats = cats
    .filter((c) => c.app_id === appId)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));

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
          <input className="field slim" name="portal_host" placeholder="Dominio portale (es. supporto.nuovaapp.it)" />
          <input className="field slim" name="from_email" placeholder="Mittente email (vuoto = quello globale)" />
          <label className="sub check" style={{ margin: "2px 0" }}>
            Colore brand&nbsp;
            <input type="color" name="accent" defaultValue="#35d07f"
              style={{ width: 44, height: 30, border: "none", background: "none", padding: 0 }} />
          </label>
          <label className="sub check" style={{ margin: "2px 0" }}>
            Logo (svg/png, fondo scuro)&nbsp;
            <input type="file" name="logo" accept=".svg,.png,image/svg+xml,image/png" />
          </label>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, opacity: c.archived ? 0.55 : 1 }}>
              <div>
                <b>{c.name}</b> <span className="sub" style={{ fontSize: 12 }}>#{c.sort_order}</span>{c.archived && <span className="pill" style={{ marginLeft: 8 }}>archiviata</span>}
                <p className="sub" style={{ margin: "4px 0 0" }}>
                  {c.faq_md ? "FAQ ✓" : "FAQ —"} · {c.info_request_md ? "checklist ✓" : "checklist —"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                {!c.archived && (
                  <button className="btn ghost slim-btn" onClick={() => setEditing(c)}>Modifica</button>
                )}
                <button className="btn ghost slim-btn" onClick={() => toggleArchive(c)}>
                  {c.archived ? "Ripristina" : "Archivia"}
                </button>
              </div>
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
          onClick={() => setEditing({ id: "", app_id: appId, slug: "", name: "", faq_md: "", info_request_md: "", archived: false, sort_order: 100 })}>
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
      <div style={{ display: "flex", gap: 8 }}>
        <input className="field slim" style={{ flex: 1 }} placeholder="Nome categoria"
          value={cat.name} onChange={(e) => onChange({ ...cat, name: e.target.value })} />
        <input className="field slim" style={{ width: 90 }} type="number" title="Ordine nel funnel (10, 20, 30…)"
          placeholder="Ordine" value={cat.sort_order || ""}
          onChange={(e) => onChange({ ...cat, sort_order: Number(e.target.value) || 100 })} />
      </div>
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
              <img src="/loghi/amia-logo.svg" alt="Amia" style={{ height: 30 }} />
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