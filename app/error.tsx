"use client";
import { useEffect, useState } from "react";
import { SUPPORT_EMAIL, buildSupportMailto, sessionSupportMailto } from "@/lib/support-mail";

/** Error boundary del portale: qualsiasi errore di runtime in una pagina
 *  finisce qui invece che in una schermata bianca. Volutamente autonomo:
 *  niente fetch, niente Supabase — deve reggere quando il resto e' giu'. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const [mailto, setMailto] = useState(buildSupportMailto());
  useEffect(() => { sessionSupportMailto().then(setMailto).catch(() => {}); }, []);
  return (
    <main className="shell">
      <div className="center">
        <div style={{ textAlign: "center", maxWidth: 420, padding: "0 20px" }}>
          <h1>Qualcosa non ha funzionato</h1>
          <p className="sub">
            Ci scusiamo per il disagio. Puoi riprovare, e se il problema
            continua scrivici a{" "}
            <a href={mailto} style={{ color: "var(--accent)", fontWeight: 700 }}>
              {SUPPORT_EMAIL}
            </a>
            : ti risponderemo al piu' presto.
          </p>
          <div style={{ height: 16 }} />
          <button className="btn" style={{ maxWidth: 220, margin: "0 auto" }} onClick={reset}>
            Riprova
          </button>
        </div>
      </div>
    </main>
  );
}