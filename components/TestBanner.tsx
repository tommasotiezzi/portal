"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SUPPORT_EMAIL, buildSupportMailto } from "@/lib/support-mail";

/**
 * Banner temporaneo di fase test (solo portale utente).
 * Il link email replica il vecchio flusso dell'app: stessa casella
 * (supporto@) e stesso subject/body precompilati con ID utente ed email,
 * quando disponibili dalla sessione.
 * A fine test: togliere <TestBanner /> dal root layout.
 */
const DISMISS_KEY = "support-test-banner-dismissed";

export default function TestBanner() {
  const [visible, setVisible] = useState(false);
  const [mailto, setMailto] = useState(buildSupportMailto("Utente", "", ""));

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
      setMailto(buildSupportMailto(name, ids?.[0]?.external_user_id ?? "", user.email ?? ""));
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