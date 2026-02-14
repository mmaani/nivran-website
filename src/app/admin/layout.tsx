// src/app/admin/layout.tsx
import "./admin.css";
import React from "react";
import { cookies } from "next/headers";
import { isAdminAuthed } from "@/lib/admin-page";
import LangToggle from "./_components/LangToggle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminLang(): Promise<"en" | "ar"> {
  const c = await cookies();
  const v = c.get("admin_lang")?.value;
  return v === "ar" ? "ar" : "en";
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, lang] = await Promise.all([isAdminAuthed(), getAdminLang()]);
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div className="admin-shell" dir={dir} data-lang={lang}>
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand">
            <a className="admin-logo" href="/">
              NIVRAN
            </a>
            <div className="admin-subtitle">{lang === "ar" ? "لوحة الإدارة" : "Admin"}</div>
          </div>

          <nav className={`admin-nav ${authed ? "" : "admin-nav-disabled"}`}>
            <a href="/admin/orders">{lang === "ar" ? "الطلبات" : "Orders"}</a>
            <a href="/admin/catalog">{lang === "ar" ? "الكتالوج" : "Catalog"}</a>
            <a href="/admin/inbox">{lang === "ar" ? "الوارد" : "Inbox"}</a>
            <a href="/admin/staff">{lang === "ar" ? "الموظفون" : "Staff"}</a>
          </nav>

          <div className="admin-actions">
            <LangToggle initialLang={lang} />

            {authed ? (
              <form action="/api/admin/logout" method="post">
                <button className="btn btn-secondary" type="submit">
                  {lang === "ar" ? "تسجيل الخروج" : "Logout"}
                </button>
              </form>
            ) : (
              <a className="btn btn-secondary" href="/admin/login">
                {lang === "ar" ? "تسجيل الدخول" : "Login"}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="admin-content">{children}</main>
    </div>
  );
}
