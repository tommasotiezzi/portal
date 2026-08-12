"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Protected from "@/components/Protected";
import { supabase, Ticket, STATUS_LABEL, STATUS_NEEDS_USER } from "@/lib/supabase";
import { useBrand } from "@/components/BrandProvider";

function TicketCard({ t }: { t: Ticket }) {
  const closed = t.status === "chiuso";
  return (
    <Link href={`/tickets/${t.id}`} className={`ticket-card${closed ? " closed" : ""}`}>
      <div className="row">
        <span className="title">{t.title}</span>
        <span className={`pill${STATUS_NEEDS_USER[t.status] ? " action" : ""}`}>
          {STATUS_LABEL[t.status]}
        </span>
      </div>
      <div className="meta">
        #{t.id}
        {t.categories?.name ? ` · ${t.categories.name}` : ""}
        {" · "}
        {new Date(t.updated_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
      </div>
    </Link>
  );
}

function TicketList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  useEffect(() => {
    supabase()
      .from("tickets")
      .select("id, title, status, created_at, updated_at, category_id, categories(name)")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setTickets((data as unknown as Ticket[]) ?? []));
  }, []);

  if (tickets === null)
    return <div className="center sub">Carico le tue richieste…</div>;

  const open = tickets.filter((t) => t.status !== "chiuso");
  const closed = tickets.filter((t) => t.status === "chiuso");

  return (
    <>
      {tickets.length === 0 && (
        <div className="center" style={{ paddingTop: 60 }}>
          <div>
            <h1>Nessuna richiesta</h1>
            <p className="sub">
              Hai un problema con l&apos;app? Apri una richiesta e ti
              rispondiamo entro 72 ore lavorative (lun–sab mattina).
            </p>
          </div>
        </div>
      )}

      {open.length > 0 && (
        <>
          <p className="section-label">Aperte</p>
          {open.map((t) => <TicketCard key={t.id} t={t} />)}
        </>
      )}

      {closed.length > 0 && (
        <>
          <p className="section-label">Chiuse</p>
          {closed.map((t) => <TicketCard key={t.id} t={t} />)}
        </>
      )}

      <div style={{ height: 90 }} />
      <Link href="/tickets/new" className="fab">+ Nuova richiesta</Link>
    </>
  );
}

export default function TicketsPage() {
  const brand = useBrand();
  return (
    <Protected>
      <main className="shell">
        <header className="topbar">
          <img src={brand.logoUrl ?? "/loghi/Logo-orizzontale-bianco.svg"} alt={brand.name} />
        </header>
        <h1>Le tue richieste</h1>
        <TicketList />
      </main>
    </Protected>
  );
}