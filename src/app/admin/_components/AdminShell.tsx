"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [loggingOut, setLoggingOut] = useState(false);
  // Avoid hydration mismatch: this component is SSR-ed, but time formatting differs between server and client.
  // Render a placeholder on the server, then fill on the client.
  const [nowLabel, setNowLabel] = useState<string>("");

  useEffect(() => {
    const format = () => new Date().toLocaleString(lang === "ar" ? "ar-JO" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
    setNowLabel(format());
    const timer = setInterval(() => setNowLabel(format()), 60_000);
    return () => clearInterval(timer);
  }, [lang]);

  const nav = useMemo(
    () => [
      { href: "/admin", en: "Dashboard", ar: "لوحة التحكم", icon: "◈" },
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

  return (
    <div className="admin-shell" data-lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-brand">
            <a href="/admin" className="admin-logo">
              NIVRAN
            </a>
            <span className="admin-badge">Admin</span>
          </div>

          <nav className="admin-nav" aria-label="Admin">
            <a href="/admin" className="admin-link">Dashboard</a>
            <a href="/admin/orders" className="admin-link">Orders</a>
            <a href="/admin/catalog" className="admin-link">Catalog</a>
            <a href="/admin/customers" className="admin-link">Customers</a>
            <a href="/admin/inbox" className="admin-link">Inbox</a>
            <a href="/admin/staff" className="admin-link">Staff</a>
          </nav>

          <div className="admin-actions">
            <form action="/api/admin/logout" method="POST">
              <button className="admin-logout" type="submit">Logout</button>
            </form>
          </div>
        </div>
      </header>

      <div className="admin-content">{children}</div>

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
    </div>
  );
}
