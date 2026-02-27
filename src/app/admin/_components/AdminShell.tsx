"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  role,
  initialLang,
  children,
}: {
  role: "admin" | "sales" | null;
  initialLang: "en" | "ar";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/admin/login" || pathname.startsWith("/admin/login?");
  const authed = role !== null;
  const isSales = role === "sales";
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const [savingLang, setSavingLang] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const nav = useMemo(
    () =>
      isSales
        ? [{ href: "/admin/sales", en: "Sales", ar: "المبيعات", icon: "◈" }]
        : [
            { href: "/admin", en: "Dashboard", ar: "لوحة التحكم", icon: "◈" },
            { href: "/admin/orders", en: "Orders", ar: "الطلبات", icon: "◎" },
            { href: "/admin/catalog", en: "Catalog", ar: "المنتجات", icon: "◇" },
            { href: "/admin/inbox", en: "Inbox", ar: "الوارد", icon: "✦" },
            { href: "/admin/customers", en: "Customers", ar: "العملاء", icon: "◉" },
            { href: "/admin/staff", en: "Staff", ar: "الموظفون", icon: "◌" },
            { href: "/admin/inventory", en: "Inventory", ar: "المخزون", icon: "▣" },
            { href: "/admin/sales", en: "Sales", ar: "المبيعات", icon: "✦" },
          ],
    [isSales]
  );

  const breadcrumbs = useMemo(() => {
    const parts = String(pathname || "").split("/").filter(Boolean);
    if (parts[0] !== "admin") return [] as Array<{ href: string; en: string; ar: string }>;

    const section = parts[1] || "";
    const sectionHref = section ? `/admin/${section}` : "/admin";
    const sectionNav = nav.find((item) => item.href === sectionHref) || nav[0];

    const out: Array<{ href: string; en: string; ar: string }> = [{ href: "/admin", en: "Admin", ar: "الإدارة" }];
    if (sectionNav && sectionNav.href !== "/admin") {
      out.push({ href: sectionNav.href, en: sectionNav.en, ar: sectionNav.ar });
    }
    return out;
  }, [pathname, nav]);

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

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("admin_lang_changed", { detail: { lang: next } }));
      }
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

  useEffect(() => {
    function onDocPointerDown(event: MouseEvent) {
      if (!menuOpen) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      const root = menuRef.current;
      if (!root) return;
      if (!root.contains(target)) setMenuOpen(false);
    }

    function onDocKeyDown(event: KeyboardEvent) {
      if (!menuOpen) return;
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [menuOpen]);

  return (
    <div className="admin-shell" data-lang={lang} data-density="comfortable" data-route={isLoginRoute ? "login" : "app"} dir={lang === "ar" ? "rtl" : "ltr"} lang={lang}>
      <header className="admin-topbar">
        <div className="admin-topbar-inner admin-topbar-compact">
          <div className="admin-topbar-head">
            <div className="admin-brand">
              <Link className="admin-logo" href={authed ? (isSales ? "/admin/sales" : "/admin") : "/admin/login"}>
                <Image src="/brand/logo.svg" alt="NIVRAN" width={34} height={34} priority />
                <span>NIVRAN</span>
              </Link>
              <p className="admin-subtitle">
                <T en="Luxury Admin Console" ar="منصة الإدارة الفاخرة" />
              </p>
            </div>

            <div className="admin-actions" ref={menuRef}>
              <Link className="btn" href="/">
                <T en="Storefront" ar="واجهة المتجر" />
              </Link>
              {authed ? (
                <button type="button" className="btn" onClick={toggleLang} disabled={savingLang}>
                  {lang === "en" ? "AR" : "EN"}
                </button>
              ) : null}

              {authed ? (
                <div className="admin-user">
                  <button className="btn admin-user-btn" type="button" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
                    <span aria-hidden>●</span>
                    <T en={isSales ? "Sales" : "Admin"} ar={isSales ? "المبيعات" : "الإدارة"} />
                    <span aria-hidden style={{ opacity: 0.7 }}>▾</span>
                  </button>

                  {menuOpen ? (
                    <div className="admin-menu" role="menu" aria-label={lang === "ar" ? "قائمة الإدارة" : "Admin menu"}>
                      <Link className="admin-menu-item" role="menuitem" href="/admin/orders" onClick={() => setMenuOpen(false)}>
                        <T en="Order queue" ar="قائمة الطلبات" />
                      </Link>
                      <Link className="admin-menu-item" role="menuitem" href="/admin/catalog#promos-section" onClick={() => setMenuOpen(false)}>
                        <T en="Campaigns" ar="الحملات" />
                      </Link>
                      <div className="admin-menu-sep" role="separator" />
                      <button className="admin-menu-item danger" type="button" role="menuitem" onClick={logout} disabled={loggingOut}>
                        <T en={loggingOut ? "Signing out…" : "Logout"} ar={loggingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {authed ? (
            <div className="admin-topbar-main">
              <nav className="admin-nav" aria-label={lang === "ar" ? "تنقّل الإدارة" : "Admin navigation"}>
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
            </div>
          ) : (
            <div className="admin-login-chip">
              <T en="Secure admin session required" ar="يلزم تسجيل دخول إداري آمن" />
            </div>
          )}

          {authed && breadcrumbs.length ? (
            <div className="admin-topbar-sub">
              <div className="admin-breadcrumbs" aria-label={lang === "ar" ? "مسار الصفحة" : "Breadcrumb"}>
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.href}-${index}`} className="admin-crumb">
                    {index > 0 ? (
                      <span className="admin-crumb-sep" aria-hidden>
                        ›
                      </span>
                    ) : null}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="admin-crumb-current">
                        <T en={crumb.en} ar={crumb.ar} />
                      </span>
                    ) : (
                      <Link href={crumb.href} className="admin-crumb-link">
                        <T en={crumb.en} ar={crumb.ar} />
                      </Link>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
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
            <Link href="/admin/inbox">
              <T en="Inbox" ar="الوارد" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
