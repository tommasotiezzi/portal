"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAdminBase } from "@/components/AdminGuard";

/** Login del backoffice: email + password (account creati a mano). */
export default function AdminLogin() {
  const router = useRouter();
  const base = useAdminBase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase().auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const { data: p } = await supabase()
        .from("profiles").select("role").eq("id", data.session.user.id).single();
      if (p?.role === "agent" || p?.role === "admin") router.replace(`${base}/inbox`);
    });
  }, [router, base]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { data, error: err } = await supabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    if (err || !data.session) {
      setError("Credenziali non valide."); setBusy(false); return;
    }
    const { data: p } = await supabase()
      .from("profiles").select("role").eq("id", data.session.user.id).single();
    if (p?.role === "agent" || p?.role === "admin") {
      router.replace(`${base}/inbox`);
    } else {
      await supabase().auth.signOut();
      setError("Credenziali non valide.");   // volutamente generico
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <div className="auth-hero">
        <div className="auth-card">
          <h1>Backoffice</h1>
          <p className="sub">Area riservata all&apos;assistenza.</p>
          <form onSubmit={login}>
            <input className="field" type="email" placeholder="Email"
              autoComplete="username"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div style={{ height: 10 }} />
            <input className="field" type="password" placeholder="Password"
              autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div style={{ height: 12 }} />
            <button className="btn" disabled={busy}>
              {busy ? "Accesso…" : "Entra"}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    </main>
  );
}