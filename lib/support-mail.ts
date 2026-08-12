/** Fallback massimale: il contatto email diretto, usato dal banner di test,
 *  dalle pagine di errore e dai punti di fallimento gestiti.
 *  Nessuna dipendenza: deve funzionare quando tutto il resto e' rotto. */
export const SUPPORT_EMAIL = "supporto@algofantacalcio.it";

export function buildSupportMailto(name = "Utente", userId = "", email = ""): string {
  // Testo semplice e corto: niente unicode decorativo o emoji
  // (gonfiano l'URL percent-encoded e Safari iOS lo rifiuta).
  const subject = `Segnalazione problema assistenza - ${name}`;
  const body =
    "Buongiorno,\r\n\r\n" +
    "ho riscontrato un problema con la nuova assistenza.\r\n\r\n" +
    "Descrizione del problema:\r\n[Scrivi qui]\r\n\r\n" +
    `ID utente: ${userId || "[Scrivi qui]"}\r\n` +
    `Email account: ${email || "[Scrivi qui]"}\r\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Mailto precompilato dalla SESSIONE CACHATA (localStorage): zero rete,
 *  funziona anche con Supabase giu'. Fallback: placeholder. */
export async function sessionSupportMailto(): Promise<string> {
  try {
    const { supabase } = await import("./supabase");
    const { data } = await supabase().auth.getSession(); // lettura locale, no rete
    const user = data.session?.user;
    if (!user) return buildSupportMailto();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const name =
      [meta.given_name, meta.family_name].filter(Boolean).join(" ") || "Utente";
    return buildSupportMailto(
      name,
      typeof appMeta.external_user_id === "string" ? appMeta.external_user_id : "",
      user.email ?? "",
    );
  } catch {
    return buildSupportMailto();
  }
}