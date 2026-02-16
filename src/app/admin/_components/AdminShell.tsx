"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  initialLang,
  children,
}: {
  authed: boolean;
  initialLang: "en" | "ar";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const [savingLang, setSavingLang] = useState(false);

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

  async function toggleLang() {
    if (savingLang) return;
    const next = lang === "en" ? "ar" : "en";
    setLang(next);
    setSavingLang(true);

    try {
      await fetch("/api/admin/lang", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lang: next, next: pathname }),
      });
      router.refresh();
    } finally {
      setSavingLang(false);
    }
  }

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
              disabled={savingLang}
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
            <Link href="/admin">
              <T en="Dashboard" ar="لوحة المعلومات" />
            </Link>
            <Link href="/admin/orders">
              <T en="Orders" ar="الطلبات" />
            </Link>
            <Link href="/admin/inbox">
              <T en="Inbox" ar="الوارد" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
