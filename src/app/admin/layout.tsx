import Link from "next/link";
import { isAdminAuthed } from "@/lib/admin-page";
import "./admin.css";
import LangToggle from "./_components/LangToggle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();

  return (
    <div className="admin-shell">
      {authed ? (
        <>
          <header className="admin-topbar">
            <div className="admin-topbar-inner">
              <div className="admin-brand">
                <Link className="admin-logo" href="/admin/orders">
                  NIVRAN
                </Link>
                <span className="admin-subtitle">
                  <T en="Admin" ar="لوحة الإدارة" />
                </span>
              </div>

              <nav className="admin-nav">
                <Link href="/admin/orders">
                  <T en="Orders" ar="الطلبات" />
                </Link>
                <Link href="/admin/catalog">
                  <T en="Catalog" ar="الكتالوج" />
                </Link>
                <Link href="/admin/inbox">
                  <T en="Inbox" ar="الوارد" />
                </Link>
                <Link href="/admin/staff">
                  <T en="Staff" ar="الموظفون" />
                </Link>
              </nav>

              <div className="admin-actions">
                <LangToggle />
                <Link className="btn btn-secondary" href="/">
                  <T en="Store" ar="المتجر" />
                </Link>

                <form action="/api/admin/logout" method="post">
                  <button className="btn btn-primary" type="submit">
                    <T en="Logout" ar="تسجيل الخروج" />
                  </button>
                </form>
              </div>
            </div>
          </header>

          <div className="admin-content">{children}</div>
        </>
      ) : (
        <div className="admin-content">
          <div className="admin-card admin-grid">
            <h1 className="admin-h1">
              <T en="Admin Access" ar="دخول الإدارة" />
            </h1>
            <p className="admin-muted">
              <T
                en="You are not authenticated. Open /admin/orders with your admin session."
                ar="أنت غير مسجّل الدخول. افتح /admin/orders باستخدام جلسة الإدارة."
              />
            </p>
            <div className="admin-row">
              <LangToggle />
              <Link className="btn" href="/">
                <T en="Back to Store" ar="العودة للمتجر" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
