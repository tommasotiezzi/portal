"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase, TicketStatus } from "@/lib/supabase";

/* ---------- etichette interne (l'operatore vede il funnel vero) ---------- */
export const ADMIN_STATUS_LABEL: Record<TicketStatus, string> = {
  nuovo: "Nuovo",
  da_rispondere: "Da rispondere",
  in_lavorazione: "In lavorazione",
  in_attesa_dev: "Attesa dev",
  chiuso: "Chiuso",
};

export type Priority = "bassa" | "media" | "alta" | "critica";
export const PRIORITIES: Priority[] = ["bassa", "media", "alta", "critica"];
export const PRIORITY_COLOR: Record<Priority, string> = {
  bassa: "#5b667a",
  media: "#4f8ef7",
  alta: "#f5a524",
  critica: "#ff5d5d",
};

/** Base URL corrente del backoffice (il path segreto sta nel browser). */
export function useAdminBase(): string {
  const pathname = usePathname();
  return "/" + (pathname.split("/")[1] ?? "");
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "ora";
  if (s < 3600) return `${Math.floor(s / 60)}m fa`;
  if (s < 86400) return `${Math.floor(s / 3600)}h fa`;
  return `${Math.floor(s / 86400)}g fa`;
}

/**
 * Guard del backoffice: richiede sessione + ruolo agent/admin.
 * Un customer autenticato vede un 404 generico: il path non rivela nulla
 * (la vera protezione dei dati resta comunque nelle RLS).
 */
export default function AdminGuard({
  children,
}: {
  children: (role: "agent" | "admin") => React.ReactNode;
}) {
  const router = useRouter();
  const base = useAdminBase();
  const [state, setState] = useState<"loading" | "denied" | "agent" | "admin">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) {
        // login, portandosi dietro la destinazione (deep link dagli embed)
        const here = window.location.pathname;
        const next = here && here !== base ? `?next=${encodeURIComponent(here)}` : "";
        router.replace(`${base}${next}`);
        return;
      }
      const { data: profile } = await supabase()
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();
      if (!active) return;
      if (profile?.role === "agent" || profile?.role === "admin") {
        setState(profile.role);
      } else {
        setState("denied");
      }
    })();
    return () => { active = false; };
  }, [router, base]);

  if (state === "loading")
    return <main className="admin-shell"><div className="center sub">Un attimo…</div></main>;

  if (state === "denied")
    return (
      <main className="admin-shell">
        <div className="center"><div>
          <h1>404</h1>
          <p className="sub">Questa pagina non esiste.</p>
        </div></div>
      </main>
    );

  return <>{children(state)}</>;
}