"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "nivran_admin_lang";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

export default function AdminShell({
  authed,
  children,
}: {
  authed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [lang, setLang] = useState<"en" | "ar">("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "ar") setLang("ar");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const nav = useMemo(
    () => [
      { href: "/admin", en: "Dashboard", ar: "لوحة المعلومات", icon: "◈" },
      { href: "/admin/orders", en: "Orders", ar: "الطلبات", icon: "◎" },
      { href: "/admin/catalog", en: "Catalog", ar: "المنتجات", icon: "◇" },
      { href: "/admin/inbox", en: "Inbox", ar: "الوارد", icon: "✦" },
      { href: "/admin/customers", en: "Customers", ar: "العملاء", icon: "◉" },
      { href: "/admin/staff", en: "Staff", ar: "الموظفون", icon: "◌" },
    ],
    []
  );

  const toggleLang = () => setLang((v) => (v === "en" ? "ar" : "en"));

  return (
    <div className="admin-shell" data-lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand">
            <Link className="admin-logo" href={authed ? "/admin" : "/admin/login"}>
              NIVRAN
            </Link>
            <span className="admin-subtitle">
              <T en="Commerce Control" ar="إدارة المتجر" />
            </span>
          </div>

          {authed ? (
            <nav className="admin-nav">
              {nav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
                    <span className="nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <T en={item.en} ar={item.ar} />
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div className="admin-login-chip">
              <T en="Secure admin access" ar="وصول إدارة آمن" />
            </div>
          )}

          <div className="admin-actions">
            <button
              type="button"
              className="btn"
              onClick={toggleLang}
              title={lang === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
            >
              {lang === "en" ? "AR" : "EN"}
            </button>

            <Link className="btn" href="/">
              <T en="Store" ar="المتجر" />
            </Link>

            {authed ? (
              <Link className="btn" href="/api/admin/logout">
                <T en="Logout" ar="تسجيل الخروج" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="admin-content">{children}</div>

      <footer className="admin-footer">
        <div className="admin-footer-inner">
          <div className="admin-footer-brand">NIVRAN Admin</div>
          <div className="admin-footer-links">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/orders">Orders</Link>
            <Link href="/admin/inbox">Inbox</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
