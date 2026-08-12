import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { BrandProvider, DEFAULT_BRAND, type Brand } from "@/components/BrandProvider";
import TestBanner from "@/components/TestBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistenza",
  description: "Apri una richiesta di assistenza e dialoga con il team di supporto.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e13",
};

/** Testo scuro o chiaro sopra l'accent, in base alla luminanza. */
function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#06281a";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#10241a" : "#ffffff";
}

/** Brand per hostname via RPC pubblica, con Next Data Cache (5 minuti):
 *  mille visite = una manciata di letture, non mille. */
async function fetchBrand(host: string): Promise<Brand> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_portal_config`,
      {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_host: host,
          p_slug: process.env.NEXT_PUBLIC_APP_SLUG ?? null, // fallback dev/localhost
        }),
        next: { revalidate: 300 },
      },
    );
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return DEFAULT_BRAND;
    return {
      slug: row.slug,
      name: row.name,
      accent: row.brand_accent ?? DEFAULT_BRAND.accent,
      logoUrl: row.logo_url ?? null,
    };
  } catch {
    return DEFAULT_BRAND;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const host = (headers().get("host") ?? "").split(":")[0];
  const brand = await fetchBrand(host);

  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* tema per-app iniettato nell'HTML: nessun flash, nessun fetch client */}
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--accent:${brand.accent};--accent-ink:${inkFor(brand.accent)};}`,
          }}
        />
      </head>
      <body>
        <TestBanner />
        <BrandProvider brand={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}