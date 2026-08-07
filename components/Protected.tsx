"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/** Wrapper per pagine che richiedono la sessione.
 *  Aspetta che supabase-js abbia processato l'eventuale magic link
 *  nell'URL prima di decidere; se non c'e' sessione -> pagina di accesso. */
export default function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    supabase().auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
    });

    const { data: sub } = supabase().auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session) setReady(true);
      else if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
        // nessuna sessione trovata (o link scaduto): si passa dall'accesso
        router.replace("/");
      }
    });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [router]);

  if (!ready) return <main className="shell"><div className="center sub">Un attimo…</div></main>;
  return <>{children}</>;
}
