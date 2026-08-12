"use client";
import { useEffect, useState } from "react";

/**
 * Banner temporaneo di fase test (solo portale utente).
 * Rimovibile dall'utente (X, memorizzato) e rimovibile da noi a fine test:
 * basta togliere <TestBanner /> dal root layout.
 */
const DISMISS_KEY = "support-test-banner-dismissed";

export default function TestBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setVisible(true);
    } catch { /* storage bloccato: banner sempre visibile */ setVisible(true); }
  }, []);

  if (!visible) return null;

  return (
    <div className="test-banner" role="status">
      <span>
        L&apos;assistenza &egrave; in fase di test. Se qualcosa non funziona,
        scrivici all&apos;indirizzo email che trovi nella sezione assistenza
        del sito di Algo.
      </span>
      <button
        aria-label="Chiudi avviso"
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ok */ }
          setVisible(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}