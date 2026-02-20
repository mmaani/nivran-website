"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminFetch } from "@/app/admin/_components/adminClient";

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

type Lang = "en" | "ar";

export default function AdminShell({
  authed,
  initialLang,
  children,
}: {
  authed: boolean;
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [lang, setLang] = useState<Lang>(initialLang);
  const [savingLang, setSavingLang] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Avoid hydration mismatch: time formatting differs between server and client.
  const [nowLabel, setNowLabel] = useState<string>("");

  useEffect(() => {
    const format = () =>
      new Date().toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });

    setNowLabel(format());
    const timer = setInterval(() => setNowLabel(format()), 60_000);
    return () => clearInterval(timer);
  }, [lang]);

  const nav = useMemo(
    () => [
      { href: "/admin", en: "Dashboard", ar: "لوحة التحكم", icon: "◈" },
      { href: "/admin/orders", en: "Orders", ar: "الطلبات", icon: "◎" },
      { href: "/admin/catalog", en: "Catalog", ar: "المنتجات", icon: "◇" },
      { href: "/admin/customers", en: "Customers", ar: "العملاء", icon: "◉" },
      { href: "/admin/inbox", en: "Inbox", ar: "الوارد", icon: "✦" },
      { href: "/admin/staff", en: "Staff", ar: "الموظفون", icon: "◌" },
    ],
    []
  );

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  async function toggleLang() {
    if (savingLang) return;

    const next: Lang = lang === "en" ? "ar" : "en";
    setLang(next);
    setSavingLang(true);

    try {
      await adminFetch("/api/admin/lang", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang: next, next: pathname }),
      });
      router.refresh();
    } finally {
      setSavingLang(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  // If not authed, Admin pages typically render login page layout separately,
  // but keep safe behavior here.
  const showChrome = authed;

  return (
    <div
      className="admin-shell"
      data-lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
    >
      {showChrome && (
        <header className="admin-topbar">
          <div className="admin-topbar-inner">
            <div className="admin-brand">
              <Link href="/admin" className="admin-logo" aria-label="NIVRAN Admin">
                NIVRAN
              </Link>
              <span className="admin-badge">Admin</span>
              <span className="admin-now" aria-label="Current time">
                {nowLabel || "—"}
              </span>
            </div>

            <nav className="admin-nav" aria-label="Admin">
              {nav.map((n) => {
                const active = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`admin-link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={lang === "ar" ? n.ar : n.en}
                  >
                    <span className="admin-link-icon" aria-hidden="true">
                      {n.icon}
                    </span>
                    <span className="admin-link-label">
                      <T en={n.en} ar={n.ar} />
                    </span>
                  </Link>
                );
              })}
            </nav>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-action"
                onClick={toggleLang}
                disabled={savingLang}
                aria-busy={savingLang}
                title={lang === "ar" ? "تبديل اللغة" : "Toggle language"}
              >
                {savingLang ? (lang === "ar" ? "..." : "...") : lang === "ar" ? "EN" : "AR"}
              </button>

              <button
                type="button"
                className="admin-logout"
                onClick={logout}
                disabled={loggingOut}
                aria-busy={loggingOut}
              >
                {loggingOut ? (lang === "ar" ? "جاري الخروج..." : "Logging out...") : lang === "ar" ? "خروج" : "Logout"}
              </button>
            </div>
          </div>
        </header>
      )}

      <div className="admin-content">{children}</div>

      {showChrome && (
        <footer className="admin-footer">
          <div className="admin-footer-inner">
            <div className="admin-footer-brand">NIVRAN Admin</div>
            <div className="admin-footer-links">
              <Link href="/admin">
                <T en="Dashboard" ar="لوحة التحكم" />
              </Link>
              <Link href="/admin/orders">
                <T en="Orders" ar="الطلبات" />
              </Link>
              <Link href="/admin/catalog">
                <T en="Catalog workspace" ar="مساحة الكتالوج" />
              </Link>
              <Link href="/admin/catalog#promos-section">
                <T en="Campaign center" ar="مركز الحملات" />
              </Link>
              <Link href="/admin/inbox">
                <T en="Inbox" ar="الوارد" />
              </Link>
              <Link href="/en/product">
                <T en="Storefront preview" ar="معاينة المتجر" />
              </Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}