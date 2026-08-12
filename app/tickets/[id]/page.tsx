"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Protected from "@/components/Protected";
import { IconClip, IconSend } from "@/components/icons";
import { supabase, Message, Ticket, STATUS_LABEL, STATUS_NEEDS_USER } from "@/lib/supabase";
import { useBrand } from "@/components/BrandProvider";

interface Attach { id: string; message_id: number | null; url: string; file_name: string; }

function TicketChat() {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const [{ data: t }, { data: msgs }, { data: atts }] = await Promise.all([
      supabase().from("tickets")
        .select("id, title, status, created_at, updated_at, category_id, categories(name)")
        .eq("id", ticketId).maybeSingle(),
      supabase().from("ticket_messages")
        .select("id, ticket_id, author_role, body, created_at")
        .eq("ticket_id", ticketId).order("created_at"),
      supabase().from("attachments")
        .select("id, message_id, storage_path, file_name")
        .eq("ticket_id", ticketId),
    ]);

    if (!t) { setNotFound(true); return; }
    setTicket(t as unknown as Ticket);
    setMessages((msgs as Message[]) ?? []);

    if (atts?.length) {
      const signed = await Promise.all(
        atts.map(async (a) => {
          const { data } = await supabase()
            .storage.from("attachments").createSignedUrl(a.storage_path, 3600);
          return { id: a.id, message_id: a.message_id, url: data?.signedUrl ?? "", file_name: a.file_name };
        }),
      );
      setAttachments(signed.filter((a) => a.url));
    }
  }, [ticketId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000); // refresh leggero: niente realtime per l'MVP
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: firstLoad.current ? "auto" : "smooth" });
    if (messages.length) firstLoad.current = false;
  }, [messages.length]);

  function onFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list)
      .filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024)
      .slice(0, 2);
    setFiles(imgs);
  }

  async function send() {
    if ((!text.trim() && files.length === 0) || busy) return;
    setBusy(true);
    const body = text.trim() || "Allegato";
    const toUpload = files;
    setText("");
    setFiles([]);
    const { data: userData } = await supabase().auth.getUser();
    const uid = userData.user!.id;
    const { data: msg, error } = await supabase()
      .from("ticket_messages")
      .insert({ ticket_id: ticketId, author_id: uid, author_role: "customer", body })
      .select("id")
      .single();
    if (error) {
      setText(body);
      setFiles(toUpload);
    } else {
      for (const f of toUpload) {
        const ext = f.name.split(".").pop() || "png";
        const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase()
          .storage.from("attachments").upload(path, f, { contentType: f.type });
        if (!upErr) {
          await supabase().from("attachments").insert({
            ticket_id: ticketId,
            message_id: msg!.id,
            storage_path: path,
            file_name: f.name,
            mime_type: f.type,
            size_bytes: f.size,
            uploaded_by: uid,
          });
        }
      }
    }
    await load();
    setBusy(false);
  }

  if (notFound)
    return (
      <div className="center">
        <div>
          <h1>Richiesta non trovata</h1>
          <p className="sub">Forse il link non è tuo o la richiesta non esiste più.</p>
          <Link className="btn ghost" href="/tickets">Le tue richieste</Link>
        </div>
      </div>
    );

  if (!ticket) return <div className="center sub">Apro la conversazione…</div>;

  const closed = ticket.status === "chiuso";

  return (
    <>
      <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 17 }}>{ticket.title}</h1>
        <span className={`pill${STATUS_NEEDS_USER[ticket.status] ? " action" : ""}`}>
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>
      <p className="sub" style={{ marginTop: 4 }}>
        #{ticket.id}{ticket.categories?.name ? ` · ${ticket.categories.name}` : ""}
      </p>

      <div className="thread">
        {messages.map((m) => {
          const mine = m.author_role === "customer";
          const atts = attachments.filter((a) => a.message_id === m.id);
          return (
            <div key={m.id} className={`bubble ${mine ? "me" : "them"}`}>
              {m.body}
              {atts.map((a) => (
                <img key={a.id} src={a.url} alt={a.file_name} className="attach" />
              ))}
              <span className="time">
                {new Date(m.created_at).toLocaleString("it-IT", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        {/* allegati caricati all'apertura (non legati a un messaggio) */}
        {attachments.filter((a) => !a.message_id).map((a) => (
          <div key={a.id} className="bubble me">
            <img src={a.url} alt={a.file_name} className="attach" />
          </div>
        ))}
        {closed && (
          <p className="system-note">
            Questa richiesta è chiusa. Se il problema si ripresenta, aprine una nuova.
          </p>
        )}
        <div ref={endRef} />
      </div>

      {!closed && (
        <div>
          {files.length > 0 && (
            <div className="attach-preview">
              {files.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} alt={f.name} />
              ))}
            </div>
          )}
          <div className="composer">
            <label className="clip">
              <IconClip />
              <input
                type="file" accept="image/*" multiple hidden
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
            <textarea
              rows={1}
              placeholder="Scrivi un messaggio…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className="send"
              disabled={busy || (!text.trim() && files.length === 0)}
              onClick={send}
            ><IconSend /></button>
          </div>
        </div>
      )}
    </>
  );
}

export default function TicketPage() {
  const brand = useBrand();
  return (
    <Protected>
      <main className="shell">
        <header className="topbar">
          <Link href="/tickets" className="back" aria-label="Indietro">←</Link>
          <img src={brand.logoUrl ?? "/loghi/Logo-orizzontale-bianco.svg"} alt={brand.name} />
        </header>
        <TicketChat />
      </main>
    </Protected>
  );
}