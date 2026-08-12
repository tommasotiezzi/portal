"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Banner temporaneo di fase test (solo portale utente).
 * Il link email replica il vecchio flusso dell'app: stessa casella
 * (supporto@) e stesso subject/body precompilati con ID utente ed email,
 * quando disponibili dalla sessione.
 * A fine test: togliere <TestBanner /> dal root layout.
 */
const DISMISS_KEY = "support-test-banner-dismissed";
const SUPPORT_EMAIL = "supporto@algofantacalcio.it";

function buildMailto(name: string, userId: string, email: string): string {
  const subject = `Segnalazione Problema Assistenza Algo - ${name}`;
  const body =
    "Buongiorno,\r\n\r\ndesidero segnalare un problema riscontrato con la nuova Assistenza di Algo Fantacalcio.\r\n\r\n" +
    "𝗗𝗲𝘀𝗰𝗿𝗶𝘇𝗶𝗼𝗻𝗲 𝗱𝗲𝗹 𝗽𝗿𝗼𝗯𝗹𝗲𝗺𝗮 *(spiega in breve cosa è successo)*:\r\n\r\n[Inserisci qui]\r\n\r\n" +
    "𝗔𝗹𝗹𝗲𝗴𝗮𝘁𝗶 𝘂𝘁𝗶𝗹𝗶 *(screenshot o registrazioni del problema)*:\r\n\r\n[Inserisci qui]\r\n\r\n" +
    "𝗗𝗮𝘁𝗶 𝗮𝗰𝗰𝗼𝘂𝗻𝘁 *(necessari per l'assistenza)*:\r\n\r\n" +
    `- 𝗜𝗗 𝘂𝘁𝗲𝗻𝘁𝗲: ${userId || "[Inserisci qui]"} \r\n` +
    `- 𝗘𝗺𝗮𝗶𝗹 𝗮𝗰𝗰𝗼𝘂𝗻𝘁: ${email || "[Inserisci qui]"} \r\n\r\n\r\n` +
    "📌 *Il supporto risponderà entro 72 ore dalla segnalazione.*";
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function TestBanner() {
  const [visible, setVisible] = useState(false);
  const [mailto, setMailto] = useState(buildMailto("Utente", "", ""));

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch { /* storage bloccato: banner visibile comunque */ }
    setVisible(true);

    // precompila con i dati della sessione, se l'utente e' loggato
    (async () => {
      const { data } = await supabase().auth.getUser();
      const user = data.user;
      if (!user) return;
      const [{ data: profile }, { data: ids }] = await Promise.all([
        supabase().from("profiles").select("given_name, family_name").eq("id", user.id).maybeSingle(),
        supabase().from("app_identities").select("external_user_id").limit(1),
      ]);
      const name =
        [profile?.given_name, profile?.family_name].filter(Boolean).join(" ") || "Utente";
      setMailto(buildMailto(name, ids?.[0]?.external_user_id ?? "", user.email ?? ""));
    })();
  }, []);

  if (!visible) return null;

  return (
    <div className="test-banner" role="status">
      <span>
        L&apos;assistenza &egrave; in fase di test. Se qualcosa non funziona,
        scrivici a <a href={mailto}>{SUPPORT_EMAIL}</a>.
      </span>
      <button
        aria-label="Chiudi avviso"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ok */ }
          setVisible(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}