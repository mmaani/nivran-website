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
  authed,
  initialLang,
  children,
}: {
  authed: boolean;
  initialLang: "en" | "ar";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/admin/login" || pathname.startsWith("/admin/login?");
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const [savingLang, setSavingLang] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
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
      { href: "/admin/inventory", en: "Inventory", ar: "المخزون", icon: "▣" },
    ],
    []
  );

  const pageMeta = useMemo(() => {
    const parts = String(pathname || "").split("/").filter(Boolean);
    const isAdminPath = parts[0] === "admin";
    if (!isAdminPath) {
      return {
        titleEn: "Admin",
        titleAr: "الإدارة",
        crumbs: [{ href: "/admin", en: "Admin", ar: "الإدارة" }],
      };
    }

    const section = parts[1] || "";
    const third = parts[2] || "";

    const sectionHref = section ? `/admin/${section}` : "/admin";
    const sectionNav = nav.find((n) => n.href === sectionHref) || nav.find((n) => n.href === "/admin");

    const crumbs: Array<{ href: string; en: string; ar: string }> = [{ href: "/admin", en: "Admin", ar: "الإدارة" }];
    if (sectionNav) {
      crumbs.push({ href: sectionNav.href, en: sectionNav.en, ar: sectionNav.ar });
    }

    if (section === "orders" && third) {
      const labelEn = `Order #${third}`;
      const labelAr = `طلب #${third}`;
      crumbs.push({ href: `/admin/orders/${third}`, en: labelEn, ar: labelAr });
      return { titleEn: labelEn, titleAr: labelAr, crumbs };
    }

    const titleEn = sectionNav?.en || "Dashboard";
    const titleAr = sectionNav?.ar || "لوحة التحكم";
    return { titleEn, titleAr, crumbs };
  }, [nav, pathname]);

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

  useEffect(() => {
    function onDocPointerDown(e: MouseEvent) {
      if (!menuOpen) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      const root = menuRef.current;
      if (!root) return;
      if (!root.contains(target)) setMenuOpen(false);
    }

    function onDocKeyDown(e: KeyboardEvent) {
      if (!menuOpen) return;
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [menuOpen]);

  return (
        <div
          className="admin-shell"
          data-lang={lang}
          data-density="comfortable"
          data-route={isLoginRoute ? "login" : "app"}
          dir={lang === "ar" ? "rtl" : "ltr"}
          lang={lang}
        >
        <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-topbar-main">
            <div className="admin-brand">
              <Link className="admin-logo" href={authed ? "/admin" : "/admin/login"}>
                <Image src="/brand/logo.svg" alt="NIVRAN" width={34} height={34} priority />
                <span>NIVRAN</span>
              </Link>
              <p className="admin-subtitle">
                <T en="Operations Console" ar="منصة تشغيل المتجر" />
              </p>
              <p className="admin-context">
                <T
                  en="Unified overview for orders, catalog, support, and payment reliability."
                  ar="نظرة موحّدة للطلبات والكتالوج والدعم وموثوقية المدفوعات."
                />
              </p>
            </div>

            {authed ? (
              <nav className="admin-nav" aria-label={lang === "ar" ? "التنقل الإداري" : "Admin navigation"}>
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
                <T en="Secure admin session required" ar="يلزم تسجيل دخول إداري آمن" />
              </div>
            )}

            <div className="admin-actions" ref={menuRef}>
                <Link className="btn" href="/">
                  <T en="Storefront" ar="واجهة المتجر" />
                </Link>

                {authed ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={toggleLang}
                    title={lang === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
                    disabled={savingLang}
                  >
                    {lang === "en" ? "AR" : "EN"}
                  </button>
                ) : null}

              {authed ? (
                <div className="admin-user">
                  <button
                    className="btn admin-user-btn"
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <span aria-hidden>●</span>
                    <T en="Admin" ar="الإدارة" />
                    <span aria-hidden style={{ opacity: 0.7 }}>
                      ▾
                    </span>
                  </button>

                  {menuOpen ? (
                    <div className="admin-menu" role="menu" aria-label={lang === "ar" ? "قائمة الإدارة" : "Admin menu"}>
                      <button
                        type="button"
                        className="admin-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          router.refresh();
                        }}
                      >
                        <T en="Refresh" ar="تحديث" />
                      </button>
                      <Link className="admin-menu-item" role="menuitem" href="/admin/catalog#promos-section" onClick={() => setMenuOpen(false)}>
                        <T en="Campaigns" ar="الحملات" />
                      </Link>
                      <Link className="admin-menu-item" role="menuitem" href="/admin/orders" onClick={() => setMenuOpen(false)}>
                        <T en="Order queue" ar="قائمة الطلبات" />
                      </Link>
                      <div className="admin-menu-sep" role="separator" />
                      <button
                        className="admin-menu-item danger"
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setMenuOpen(false);
                          await logout();
                        }}
                        disabled={loggingOut}
                      >
                        <T en={loggingOut ? "Signing out…" : "Logout"} ar={loggingOut ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {authed ? (
            <div className="admin-topbar-sub">
              <div className="admin-breadcrumbs" aria-label={lang === "ar" ? "مسار الصفحة" : "Breadcrumb"}>
                {pageMeta.crumbs.map((c, idx) => {
                  const isLast = idx === pageMeta.crumbs.length - 1;
                  return (
                    <span key={`${c.href}-${idx}`} className="admin-crumb">
                      {idx > 0 ? <span className="admin-crumb-sep" aria-hidden>›</span> : null}
                      {isLast ? (
                        <span className="admin-crumb-current">
                          <T en={c.en} ar={c.ar} />
                        </span>
                      ) : (
                        <Link href={c.href} className="admin-crumb-link">
                          <T en={c.en} ar={c.ar} />
                        </Link>
                      )}
                    </span>
                  );
                })}
              </div>

              <div className="admin-context-row">
                <span className="admin-pill"><T en="Live operations" ar="تشغيل مباشر" /></span>
                <span className="admin-pill admin-pill-muted" suppressHydrationWarning>
                  {nowLabel || "—"}
                </span>
                <span className="admin-pill admin-pill-title">
                  <T en={pageMeta.titleEn} ar={pageMeta.titleAr} />
                </span>
                <Link className="admin-mini-link" href="/admin/catalog#promos-section"><T en="Campaigns" ar="الحملات" /></Link>
                <Link className="admin-mini-link" href="/admin/catalog#variants-section"><T en="Variants" ar="المتغيرات" /></Link>
                <Link className="admin-mini-link" href="/admin/orders"><T en="Order queue" ar="قائمة الطلبات" /></Link>
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
