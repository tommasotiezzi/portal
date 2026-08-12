"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Protected from "@/components/Protected";
import { supabase, Category } from "@/lib/supabase";
import { useBrand } from "@/components/BrandProvider";
import { IconClip, IconSend } from "@/components/icons";

/**
 * Apertura richiesta in stile chatbot:
 *   bot: "Di cosa hai bisogno?" -> chips categorie
 *   bot: risposta FAQ precompilata della categoria (se esiste)
 *   bot: "Abbiamo risolto?" -> [Si', risolto] / [No, chatta con l'assistenza]
 *   -> descrizione + allegati -> il ticket nasce e si va nella chat vera.
 *
 * Supporta i parametri dell'app (openFaqReport):
 *   ?category=<slug>&referenceId=<id>  -> categoria preselezionata.
 */
type Step = "category" | "faq" | "userid" | "describe" | "done";
type Bot = { who: "bot" | "me"; text: string };

/** Markdown minimo per le bolle del bot: solo **grassetto**.
 *  Prima l'escape HTML (il contenuto resta inerte), poi il bold. */
function mdLite(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function NewTicketFlow() {
  const brand = useBrand();
  const router = useRouter();
  const params = useSearchParams();
  const [cats, setCats] = useState<Category[]>([]);
  const [step, setStep] = useState<Step>("category");
  const [chat, setChat] = useState<Bot[]>([
    { who: "bot", text: "Ciao! Dimmi di cosa hai bisogno: scegli l'argomento che descrive meglio il tuo problema." },
  ]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [hasIdentity, setHasIdentity] = useState<boolean | null>(null);
  const [algoUserId, setAlgoUserId] = useState("");
  const [userIdDraft, setUserIdDraft] = useState("");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase()
      .from("app_identities")
      .select("id")
      .limit(1)
      .then(({ data }) => setHasIdentity((data ?? []).length > 0));
    (async () => {
      // regola: l'app di provenienza (handoff) vince sull'hostname.
      // Chi entra dal fallback email non ha provenienza -> app del portale.
      const { data: u } = await supabase().auth.getUser();
      const fromHandoff =
        (u.user?.app_metadata as Record<string, unknown> | undefined)?.last_app_slug;
      const effectiveSlug =
        typeof fromHandoff === "string" && fromHandoff ? fromHandoff : brand.slug;
      supabase()
        .rpc("get_app_categories", { p_app_slug: effectiveSlug })
        .then(({ data }) => {
        const list = (data as unknown as Category[]) ?? [];
        setCats(list);
        // preselezione da openFaqReport
        const pre = params.get("category");
        if (pre) {
          const c = list.find((x) => x.slug === pre);
          if (c) pickCategory(c, list);
        }
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat, step]);

  function pickCategory(c: Category, _list?: Category[]) {
    setSelected(c);
    setChat((h) => [...h, { who: "me", text: c.name }]);
    if (c.faq_md) {
      setChat((h) => [
        ...h,
        { who: "bot", text: c.faq_md! },
        { who: "bot", text: "Abbiamo risolto il tuo problema?" },
      ]);
      setStep("faq");
    } else {
      nextAfterFaq(c);
    }
  }

  function askDescription(cat?: Category | null) {
    const c = cat ?? selected;
    const checklist = c?.info_request_md
      ? `\n\nPer aiutarti al meglio, includi:\n${c.info_request_md}`
      : "";
    setChat((h) => [
      ...h,
      { who: "bot", text: `Ok, chattiamo con l'assistenza. Descrivimi il problema nel modo più preciso possibile — se hai screenshot, allegali: ci aiutano tantissimo.${checklist}\n\nTi risponderemo entro 72 ore lavorative (lun–sab mattina).` },
    ]);
    setStep("describe");
  }

  /** Da desktop/web l'identita' dell'app non c'e': l'ID va chiesto. */
  function nextAfterFaq(cat?: Category | null) {
    if (hasIdentity === false) {
      setChat((h) => [
        ...h,
        { who: "bot", text: "Prima di tutto mi serve il tuo **ID utente Algo**, così l'assistenza trova subito il tuo account. Lo trovi nell'app: **Hub → Profilo**." },
      ]);
      setStep("userid");
    } else {
      askDescription(cat);
    }
  }

  function submitUserId() {
    const v = userIdDraft.trim();
    if (!v) return;
    setAlgoUserId(v);
    setChat((h) => [...h, { who: "me", text: v }]);
    askDescription();
  }

  function solved() {
    setChat((h) => [
      ...h,
      { who: "me", text: "Sì, risolto" },
      { who: "bot", text: "Perfetto. Se ti serve altro, sai dove trovarmi." },
    ]);
    setStep("done");
  }

  function notSolved() {
    setChat((h) => [...h, { who: "me", text: "No, non ho risolto" }]);
    nextAfterFaq();
  }

  function onFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list)
      .filter((f) => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024)
      .slice(0, 2);
    setFiles(imgs);
  }

  async function createTicket() {
    if (!desc.trim() || !selected) return;
    setBusy(true);
    setError("");
    try {
      const { data: userData } = await supabase().auth.getUser();
      const uid = userData.user!.id;

      const title =
        desc.trim().length > 60 ? desc.trim().slice(0, 57) + "…" : desc.trim();

      const { data: ticket, error: tErr } = await supabase()
        .from("tickets")
        .insert({
          app_id: selected.app_id,
          user_id: uid,
          category_id: selected.id,
          title: `${selected.name}: ${title}`.slice(0, 200),
          reference_id: params.get("referenceId"),
          metadata: {
            source: hasIdentity ? "app" : "web",
            ...(algoUserId ? { algo_user_id: algoUserId } : {}),
          },
        })
        .select("id")
        .single();
      if (tErr) throw tErr;

      const { data: firstMsg, error: mErr } = await supabase()
        .from("ticket_messages")
        .insert({ ticket_id: ticket!.id, author_id: uid, author_role: "customer", body: desc.trim() })
        .select("id")
        .single();
      if (mErr) throw mErr;

      // allegati (max 2, gia' filtrati)
      for (const f of files) {
        const ext = f.name.split(".").pop() || "png";
        const path = `${ticket!.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase()
          .storage.from("attachments").upload(path, f, { contentType: f.type });
        if (!upErr) {
          await supabase().from("attachments").insert({
            ticket_id: ticket!.id,
            message_id: firstMsg!.id,
            storage_path: path,
            file_name: f.name,
            mime_type: f.type,
            size_bytes: f.size,
            uploaded_by: uid,
          });
        }
      }

      router.replace(`/tickets/${ticket!.id}`);
    } catch (e) {
      setError("Non sono riuscito a creare la richiesta. Riprova tra un attimo.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="thread">
        {chat.map((m, i) =>
          m.who === "bot" ? (
            <div
              key={i}
              className="bubble them"
              dangerouslySetInnerHTML={{ __html: mdLite(m.text) }}
            />
          ) : (
            <div key={i} className="bubble me">{m.text}</div>
          ),
        )}

        {step === "category" && cats.length > 0 && (
          <div className="chips">
            {cats.map((c) => (
              <button key={c.id} className="chip" onClick={() => pickCategory(c)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {step === "faq" && (
          <div className="chips">
            <button className="chip" onClick={solved}>Sì, risolto</button>
            <button className="chip" onClick={notSolved}>No, chatta con l&apos;assistenza</button>
          </div>
        )}

        {step === "done" && (
          <div className="chips">
            <Link href="/tickets" className="chip" style={{ textDecoration: "none" }}>
              ← Torna alle richieste
            </Link>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div ref={endRef} />
      </div>

      {step === "userid" && (
        <div className="composer">
          <input
            className="field"
            style={{ flex: 1, borderRadius: 18 }}
            placeholder="Il tuo ID utente Algo…"
            value={userIdDraft}
            onChange={(e) => setUserIdDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitUserId()}
          />
          <button className="send" disabled={!userIdDraft.trim()} onClick={submitUserId}>
            <IconSend />
          </button>
        </div>
      )}

      {step === "describe" && (
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
              rows={2}
              placeholder="Descrivi il problema…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <button className="send" disabled={busy || !desc.trim()} onClick={createTicket}>
              {busy ? "…" : <IconSend />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function NewTicketPage() {
  const brand = useBrand();
  return (
    <Protected>
      <main className="shell">
        <header className="topbar">
          <Link href="/tickets" className="back" aria-label="Indietro">←</Link>
          <img src={brand.logoUrl ?? "/loghi/Logo-orizzontale-bianco.svg"} alt={brand.name} />
        </header>
        <Suspense>
          <NewTicketFlow />
        </Suspense>
      </main>
    </Protected>
  );
}