import { NextRequest, NextResponse } from "next/server";

/**
 * Smistamento per hostname + path segreto (defense in depth).
 *
 *   ADMIN_HOST/{ADMIN_PATH}/*  -> backoffice (rewrite verso /admin/*)
 *   ADMIN_HOST/<altro>         -> 404 (il dominio CRM non mostra nulla)
 *   <dominio portale>/*        -> portale utente; /admin e {ADMIN_PATH} -> 404
 *
 * In locale (localhost) restano attive entrambe le facce:
 *   localhost:3000             -> portale
 *   localhost:3000/{ADMIN_PATH} -> backoffice
 *
 * Env (server-only):
 *   ADMIN_PATH  es. a3f9c21b40de
 *   ADMIN_HOST  es. crm.amia.technology  (vuoto in locale)
 */
const ADMIN_PATH = process.env.ADMIN_PATH || "gst-x7k2m9";
const ADMIN_HOST = process.env.ADMIN_HOST || "";

function to404(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/__nope";
  return NextResponse.rewrite(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const isAdminHost = ADMIN_HOST !== "" && host === ADMIN_HOST;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const onSecretPath =
    pathname === `/${ADMIN_PATH}` || pathname.startsWith(`/${ADMIN_PATH}/`);

  // le route interne /admin non sono mai raggiungibili direttamente
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return to404(req);

  if (isAdminHost) {
    // dominio CRM: esiste SOLO il path segreto
    if (onSecretPath) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(`/${ADMIN_PATH}`, "/admin") || "/admin";
      return NextResponse.rewrite(url);
    }
    return to404(req);
  }

  // dominio portale (o locale): il path segreto funziona solo in locale
  if (onSecretPath) {
    if (isLocal || ADMIN_HOST === "") {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(`/${ADMIN_PATH}`, "/admin") || "/admin";
      return NextResponse.rewrite(url);
    }
    return to404(req);
  }
}

export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };