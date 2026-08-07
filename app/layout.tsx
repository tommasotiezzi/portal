import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistenza — Algo Fantacalcio",
  description: "Apri una richiesta di assistenza e dialoga con il team Algo.",
  // niente `icons`: il favicon e' app/icon.svg, Next genera i tag da solo
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e13",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}