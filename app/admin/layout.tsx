import ThemeToggle from "@/components/ThemeToggle";

/** Layout del backoffice: tema Amia su tutte le route /admin.
 *  Ibrido chiaro/scuro: default dal sistema, toggle per forzare.
 *  Lo script inline applica la classe PRIMA del paint (niente flash). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="amia" id="amia-root" suppressHydrationWarning>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var t=localStorage.getItem('amia-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.currentScript.parentElement.classList.add('dark')}catch(e){}",
        }}
      />
      {children}
      <ThemeToggle />
    </div>
  );
}