"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Scambio token -> sessione, tutto sul NOSTRO dominio.
 * I link (handoff, email) puntano qui con ?token_hash=...&next=...
 * cosi' l'utente non vede mai l'endpoint Supabase nella barra.
 * Link scaduto/invalido -> pagina di accesso (chiedera' un link nuovo).
 */
function Confirm() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const next = params.get("next") || "/tickets";
    if (!tokenHash) { router.replace("/"); return; }
    supabase()
      .auth.verifyOtp({ type: "email", token_hash: tokenHash })
      .then(({ error }) => router.replace(error ? "/" : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="center sub">Un attimo, ti sto facendo entrare…</div>;
}

export default function ConfirmPage() {
  return (
    <main className="shell">
      <Suspense fallback={<div className="center sub">Un attimo…</div>}>
        <Confirm />
      </Suspense>
    </main>
  );
}