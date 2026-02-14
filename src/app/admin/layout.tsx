// src/app/admin/layout.tsx
import Link from "next/link";
import { isAdminAuthed } from "@/lib/admin-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();

  return (
    <div className="admin-shell">
      {authed ? (
        <>
          <header className="admin-topbar">
            <div className="admin-brand">
              <Link className="admin-logo" href="/admin/orders">NIVRAN</Link>
              <span className="admin-subtitle">Admin</span>
            </div>

            <nav className="admin-nav">
              <Link href="/admin/orders">Orders</Link>
              <Link href="/admin/catalog">Catalog</Link>
              <Link href="/admin/inbox">Inbox</Link>
              <Link href="/admin/staff">Staff</Link>
            </nav>

            <div className="admin-actions">
              <Link className="btn btn-secondary" href="/">Store</Link>
            </div>
          </header>

          <div className="admin-content">{children}</div>
        </>
      ) : (
        <div className="admin-content">{children}</div>
      )}
    </div>
  );
}
