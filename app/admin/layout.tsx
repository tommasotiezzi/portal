/** Layout del backoffice: applica il tema Amia (dark) a tutte le route /admin.
 *  Il portale utente resta sul tema per-app; questo e' lo strumento aziendale. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="amia">{children}</div>;
}