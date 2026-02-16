import "./admin.css";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="admin-nav-link" href={href}>
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <div className="admin-brand">NIVRAN Admin</div>
        <nav style={{ display: "grid", gap: 6 }}>
          <NavLink href="/admin/orders" label="Orders" />
          <NavLink href="/admin/catalog" label="Catalog" />
          <NavLink href="/admin/customers" label="Customers" />
          <NavLink href="/admin/staff" label="Staff" />
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
