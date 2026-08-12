"use client";
import { SUPPORT_EMAIL, buildSupportMailto } from "@/lib/support-mail";

/** Ultima spiaggia: errore nel root layout stesso (il CSS potrebbe non
 *  esserci — stili inline). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#0b0e13", color: "#f4f7fb",
        fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
        minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ maxWidth: 420, padding: 20 }}>
          <h1 style={{ fontSize: 22 }}>Qualcosa non ha funzionato</h1>
          <p style={{ color: "#8b95a7", fontSize: 14.5, lineHeight: 1.6 }}>
            Ci scusiamo per il disagio. Puoi riprovare, e se il problema continua
            scrivici a{" "}
            <a href={buildSupportMailto()} style={{ color: "#35d07f", fontWeight: 700 }}>
              {SUPPORT_EMAIL}
            </a>.
          </p>
          <button onClick={reset} style={{ marginTop: 12, background: "#35d07f",
            color: "#06281a", border: "none", borderRadius: 12, padding: "12px 28px",
            fontWeight: 700, fontSize: 15 }}>
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}