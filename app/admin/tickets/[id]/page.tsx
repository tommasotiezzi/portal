"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AdminGuard, {
  ADMIN_STATUS_LABEL, PRIORITIES, PRIORITY_COLOR, Priority, timeAgo, useAdminBase,
} from "@/components/AdminGuard";
import { IconCopy, IconSend } from "@/components/icons";
import { supabase, Message, TicketStatus } from "@/lib/supabase";

interface Detail {
  id: number;
  title: string;
  status: TicketStatus;
  priority: Priority;
  created_at: string;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  user_id: string;
  locked_by: string | null;
  categories: { name: string } | null;
  apps: { name: string } | null;
  profiles: { email: string; given_name: string | null; family_name: string | null } | null;
}
interface Identity { external_user_id: string; access_status: string | null; apps: { name: string } | null; }
interface HistoryRow { id: number; title: string; status: TicketStatus; created_at: string; }
interface Attach { id: string; message_id: number | null; url: string; file_name: string; }

/** Valore + copia negli appunti con feedback. */
function CopyVal({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <b style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {value}
      <button
        className="copy-btn"
        title="Copia"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        }}
      >
        {ok ? "✓" : <IconCopy />}
      </button>
    </b>
  );
}

function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  const base = useAdminBase();
  const [t, setT] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data: ticket } = await supabase()
      .from("tickets")
      .select("id, title, status, priority, created_at, reference_id, metadata, user_id, locked_by, categories(name), apps(name), profiles!tickets_user_id_fkey(email, given_name, family_name)")
      .eq("id", ticketId).maybeSingle();
    if (!ticket) return;
    const d = ticket as unknown as Detail;
    setT(d);

    const [{ data: msgs }, { data: atts }, { data: ids }, { data: hist }] = await Promise.all([
      supabase().from("ticket_messages")
        .select("id, ticket_id, author_role, body, created_at")
        .eq("ticket_id", ticketId).order("created_at"),
      supabase().from("attachments")
        .select("id, message_id, storage_path, file_name").eq("ticket_id", ticketId),
      supabase().from("app_identities")
        .select("external_user_id, access_status, apps(name)").eq("profile_id", d.user_id),
      supabase().from("tickets")
        .select("id, title, status, created_at")
        .eq("user_id", d.user_id).neq("id", ticketId)
        .order("created_at", { ascending: false }).limit(8),
    ]);
    setMessages((msgs as Message[]) ?? []);
    setIdentities((ids as unknown as Identity[]) ?? []);
    setHistory((hist as HistoryRow[]) ?? []);
    if (atts?.length) {
      const signed = await Promise.all(atts.map(async (a) => {
        const { data } = await supabase().storage.from("attachments")
          .createSignedUrl(a.storage_path, 3600);
        return { id: a.id, message_id: a.message_id, url: data?.signedUrl ?? "", file_name: a.file_name };
      }));
      setAttachments(signed.filter((a) => a.url));
    }
  }, [ticketId]);

  // claim all'apertura, release all'uscita (il release e' un no-op se hai risposto)
  useEffect(() => {
    supabase().rpc("claim_ticket", { p_ticket_id: ticketId }).then(load);
    const t = setInterval(load, 10000);
    return () => {
      clearInterval(t);
      supabase().rpc("release_ticket", { p_ticket_id: ticketId });
    };
  }, [ticketId, load]);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages.length]);

  async function send(resolve: boolean) {
    if (!text.trim() || busy) return;
    setBusy(true);
    const body = text.trim();
    setText("");
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("ticket_messages").insert({
      ticket_id: ticketId, author_id: u.user!.id, author_role: "agent", body,
    });
    if (error) { setText(body); setBusy(false); return; }
    if (resolve) await setStatus("risolto");
    await load();
    setBusy(false);
  }

  async function setStatus(status: TicketStatus) {
    await supabase().from("tickets").update({ status }).eq("id", ticketId);
    await load();
  }

  async function setPriority(priority: Priority) {
    await supabase().from("tickets").update({ priority }).eq("id", ticketId);
    await load();
  }

  if (!t) return <div className="center sub">Apro il ticket…</div>;

  const meta = t.metadata ?? {};
  const customerName =
    [t.profiles?.given_name, t.profiles?.family_name].filter(Boolean).join(" ");

  return (
    <div className="detail-grid">
      {/* ---------- colonna chat ---------- */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>#{t.id} · {t.title}</h1>
          <span className={`pill s-${t.status}`}>{ADMIN_STATUS_LABEL[t.status]}</span>
        </div>
        <p className="sub" style={{ marginTop: 4 }}>
          {t.categories?.name ?? "—"} · aperto {timeAgo(t.created_at)}
        </p>

        <div className="thread">
          {messages.map((m) => {
            const customer = m.author_role === "customer";
            const atts = attachments.filter((a) => a.message_id === m.id);
            return (
              <div key={m.id} className={`bubble ${customer ? "them" : "me"}`}>
                {m.body}
                {atts.map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={a.file_name} className="attach" />
                  </a>
                ))}
                <span className="time">{timeAgo(m.created_at)}</span>
              </div>
            );
          })}
          {attachments.filter((a) => !a.message_id).map((a) => (
            <div key={a.id} className="bubble them">
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.url} alt={a.file_name} className="attach" />
              </a>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {t.status !== "chiuso" && (
          <div>
            <div className="composer">
              <textarea rows={2} placeholder="Rispondi al cliente…"
                value={text} onChange={(e) => setText(e.target.value)} />
              <button className="send" title="Invia"
                disabled={busy || !text.trim()} onClick={() => send(false)}>
                <IconSend />
              </button>
            </div>
            <button className="btn ghost slim-btn"
              disabled={busy || !text.trim()} onClick={() => send(true)}>
              Invia e segna risolto
            </button>
          </div>
        )}
      </section>

      {/* ---------- sidebar contesto ---------- */}
      <aside>
        <div className="side-card">
          <p className="side-title">Cliente</p>
          {customerName && <div className="kv"><span>Nome</span><b>{customerName}</b></div>}
          <div className="kv"><span>Email</span>
            {t.profiles?.email ? <CopyVal value={t.profiles.email} /> : <b>—</b>}</div>
          {identities.length > 0 ? (
            identities.map((i, k) => (
              <div key={k}>
                <div className="kv"><span>ID utente ✓</span><CopyVal value={i.external_user_id} /></div>
                {i.access_status && <div className="kv"><span>Piano</span><b>{i.access_status}</b></div>}
              </div>
            ))
          ) : (
            <>
              <div className="kv"><span>ID dichiarato</span>
                {meta.algo_user_id
                  ? <CopyVal value={String(meta.algo_user_id)} />
                  : <b>—</b>}</div>
              <div className="kv"><span>Sorgente</span><b>{(meta.source as string) ?? "web"}</b></div>
            </>
          )}
          {t.reference_id && (
            <div className="kv"><span>Rif. segnalazione</span><b>{t.reference_id}</b></div>
          )}
        </div>

        <div className="side-card">
          <p className="side-title">Gestione</p>
          <div className="kv"><span>Priorità</span>
            <select className="field slim" value={t.priority}
              onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="side-actions">
            {t.status !== "risolto" && t.status !== "chiuso" && (
              <button className="btn ghost slim-btn" onClick={() => setStatus("risolto")}>
                Segna risolto
              </button>
            )}
            {t.status !== "chiuso" && (
              <button className="btn ghost slim-btn" onClick={() => setStatus("chiuso")}>
                Chiudi
              </button>
            )}
            {(t.status === "chiuso" || t.status === "risolto") && (
              <button className="btn ghost slim-btn" onClick={() => setStatus("in_lavorazione")}>
                Riapri
              </button>
            )}
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="side-card">
            <p className="side-title">Allegati ({attachments.length})</p>
            <div className="attach-grid">
              {attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.file_name}>
                  <img src={a.url} alt={a.file_name} />
                </a>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="side-card">
            <p className="side-title">Altre richieste</p>
            {history.map((h) => (
              <Link key={h.id} href={`${base}/tickets/${h.id}`} className="hist-row">
                <span>#{h.id} {h.title.slice(0, 34)}{h.title.length > 34 ? "…" : ""}</span>
                <span className={`pill s-${h.status}`}>{ADMIN_STATUS_LABEL[h.status]}</span>
              </Link>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

export default function AdminTicketPage() {
  const base = useAdminBase();
  return (
    <AdminGuard>
      {() => (
        <main className="admin-shell">
          <header className="admin-top">
            <Link href={`${base}/inbox`} className="back">←</Link>
            <img src="/loghi/amia-white.svg" alt="Amia" style={{ height: 30 }} />
            <span />
          </header>
          <TicketDetail />
        </main>
      )}
    </AdminGuard>
  );
}