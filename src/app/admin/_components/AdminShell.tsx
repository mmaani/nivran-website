// src/app/admin/_components/AdminShell.tsx
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
      { href: "/admin/orders", en: "Orders", ar: "الطلبات" },
      { href: "/admin/catalog", en: "Catalog", ar: "المنتجات" },
      { href: "/admin/inbox", en: "Inbox", ar: "الوارد" },
      { href: "/admin/staff", en: "Staff", ar: "الموظفون" },
    ],
    []
  );

  const toggleLang = () => setLang((v) => (v === "en" ? "ar" : "en"));

  return (
    <div className="admin-shell" data-lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      {authed ? (
        <header className="admin-topbar">
          <div className="admin-brand">
            <Link className="admin-logo" href="/admin/orders">
              NIVRAN
            </Link>
            <span className="admin-subtitle">
              <T en="Admin" ar="لوحة التحكم" />
            </span>
          </div>

          <nav className="admin-nav">
            {nav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "active" : ""}`}
                >
                  <T en={item.en} ar={item.ar} />
                </Link>
              );
            })}
          </nav>

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

            <Link className="btn" href="/api/admin/logout">
              <T en="Logout" ar="تسجيل الخروج" />
            </Link>
          </div>
        </header>
      ) : null}

      <div className="admin-content">{children}</div>
    </div>
  );
}
