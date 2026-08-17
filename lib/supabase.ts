"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Client Supabase browser (singleton).
 *  detectSessionInUrl raccoglie automaticamente la sessione quando
 *  l'utente atterra da un magic link. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, detectSessionInUrl: true, flowType: "implicit" } },
    );
  }
  return client;
}

// ---------- tipi minimi ----------
export type TicketStatus =
  | "nuovo" | "in_lavorazione" | "da_rispondere" | "in_attesa_dev" | "chiuso";

export interface Ticket {
  id: number;
  title: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  categories?: { name: string } | null;
}

export interface Message {
  id: number;
  ticket_id: number;
  author_role: "customer" | "agent" | "admin";
  body: string;
  created_at: string;
}

export interface Category {
  id: string;
  app_id: string;
  slug: string;
  name: string;
  faq_md: string | null;
  info_request_md: string | null;
}

// ---------- stati in linguaggio umano (mai il funnel interno) ----------
export const STATUS_LABEL: Record<TicketStatus, string> = {
  nuovo: "Richiesta ricevuta",
  in_lavorazione: "Ti abbiamo risposto",   // dal punto di vista del cliente
  da_rispondere: "In lavorazione",         // ha scritto lui, lavoriamo noi
  in_attesa_dev: "In verifica tecnica",
  chiuso: "Risolta e chiusa",
};

/** Lo stato richiede un'azione dell'utente? (pill evidenziata) */
export const STATUS_NEEDS_USER: Record<TicketStatus, boolean> = {
  nuovo: false,
  in_lavorazione: true,    // c'e' una nostra risposta da leggere
  da_rispondere: false,
  in_attesa_dev: false,
  chiuso: false,
};

// Lo slug dell'app e' risolto a runtime per hostname (vedi BrandProvider);
// NEXT_PUBLIC_APP_SLUG resta come fallback per localhost/dev nel root layout.