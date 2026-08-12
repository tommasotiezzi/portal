"use client";
import { useEffect, useState } from "react";

/** Toggle tema del backoffice (ibrido):
 *  default dal sistema, il click forza e salva la preferenza. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.getElementById("amia-root");
    if (!root) return;
    setDark(root.classList.contains("dark"));
    // se non c'e' preferenza esplicita, segui i cambi del sistema in tempo reale
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("amia-theme")) {
        root.classList.toggle("dark", e.matches);
        setDark(e.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const root = document.getElementById("amia-root");
    if (!root) return;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    localStorage.setItem("amia-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button className="theme-toggle" onClick={toggle}
      aria-label="Cambia tema" title={dark ? "Tema chiaro" : "Tema scuro"}>
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}