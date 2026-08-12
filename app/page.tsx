"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { IconMail } from "@/components/icons";
import { useBrand } from "@/components/BrandProvider";

/**
 * Accesso al portale.
 * - Chi arriva dall'app (handoff) o da un magic link ha gia' la sessione
 *   e viene mandato dritto a /tickets.
 * - Chi arriva "a freddo" (o con link scaduto) inserisce l'email e riceve
 *   un nuovo link. Il messaggio di conferma e' identico in ogni caso:
 *   il form non rivela mai se un'email e' registrata (no enumeration).
 */
export default function AccessPage() {
  const brand = useBrand();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/tickets");
      else setChecking(false);
    });
    const { data: sub } = supabase().auth.onAuthStateChange((_e, session) => {
      if (session) router.replace("/tickets");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/tickets` },
    });
    // esito volutamente identico anche in caso di errore lato server
    setSent(true);
    setBusy(false);
  }

  if (checking)
    return (
      <main className="shell">
        <div className="center sub">Un attimo…</div>
      </main>
    );

  return (
    <main className="shell">
      <header className="topbar">
        <img src={brand.logoUrl ?? "/loghi/Logo-orizzontale-bianco.svg"} alt={brand.name} />
      </header>

      <div className="auth-hero">
        {sent ? (
          <div className="auth-card" style={{ textAlign: "center" }}>
            <span className="hero-icon"><IconMail /></span>
            <h1>Controlla la posta</h1>
            <p className="sub">
              Se l&apos;email &egrave; corretta, riceverai un link di accesso tra
              pochi istanti. Controlla anche lo spam. Il link scade tra
              un&apos;ora: se non lo usi in tempo, torna qui e richiedine un altro.
            </p>
            <button className="btn ghost" onClick={() => setSent(false)}>
              Usa un&apos;altra email
            </button>
          </div>
        ) : (
          <div className="auth-card">
            <h1>Assistenza {brand.name}</h1>
            <p className="sub">
              Inserisci l&apos;email del tuo account: ti inviamo un link di
              accesso, senza password. Dal link entri direttamente nelle tue
              richieste.
            </p>
            <form onSubmit={sendLink}>
              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="la-tua-email@esempio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <div style={{ height: 12 }} />
              <button className="btn" disabled={busy || !email.includes("@")}>
                {busy ? "Invio…" : "Inviami il link di accesso"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}