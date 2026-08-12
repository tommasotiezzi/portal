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