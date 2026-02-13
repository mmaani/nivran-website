const LINKS = {
  en: { home: "Home", story: "Story", product: "Shop", faq: "FAQ", contact: "Contact", checkout: "Checkout", account: "Account", admin: "Admin", menu: "Menu", lang: "العربية" },
  ar: { home: "الرئيسية", story: "قصتنا", product: "المتجر", faq: "الأسئلة", contact: "تواصل", checkout: "الدفع", account: "حسابي", admin: "الإدارة", menu: "القائمة", lang: "English" },
};

export default async function StoreLocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const t = LINKS[locale];
  const href = (p: string) => `/${locale}${p}`;
  const switchTo = locale === "ar" ? "en" : "ar";

  return (
    <div lang={locale} dir={isAr ? "rtl" : "ltr"}>
      <header className="site-header">
        <div className="shell topbar">
          <a className="brand" href={href("")}>
            <strong>{isAr ? "نيفـران" : "NIVRAN"}</strong>
            <span>{isAr ? "ارتدِ الهدوء" : "Wear the calm."}</span>
          </a>

          <nav className="main-nav desktop-nav">
            <a href={href("")}>{t.home}</a>
            <a href={href("/story")}>{t.story}</a>
            <a href={href("/product")}>{t.product}</a>
            <a href={href("/faq")}>{t.faq}</a>
            <a href={href("/contact")}>{t.contact}</a>
            <a className="nav-cta" href={href("/checkout")}>{t.checkout}</a>
            <a href={href("/account")}>{t.account}</a>
            <a href={`/${switchTo}`}>{t.lang}</a>
            <a href="/admin/orders">{t.admin}</a>
          </nav>

          <details className="mobile-nav" role="navigation">
            <summary>{t.menu}</summary>
            <div className="mobile-nav-panel">
              <a href={href("")}>{t.home}</a>
              <a href={href("/story")}>{t.story}</a>
              <a href={href("/product")}>{t.product}</a>
              <a href={href("/faq")}>{t.faq}</a>
              <a href={href("/contact")}>{t.contact}</a>
              <a className="nav-cta" href={href("/checkout")}>{t.checkout}</a>
              <a href={href("/account")}>{t.account}</a>
              <a href={`/${switchTo}`}>{t.lang}</a>
              <a href="/admin/orders">{t.admin}</a>
            </div>
          </details>
        </div>
      </header>

      <main className="shell">{children}</main>

      <footer className="site-footer">
        <div className="shell" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div>© {new Date().getFullYear()} NIVRAN · Jordan</div>
          <div style={{ marginInlineStart: "auto" }}>{isAr ? "صياغة آمنة بدون ادعاءات علاجية." : "Claim-safe wording. No therapeutic claims."}</div>
        </div>
      </footer>
    </div>
  );
}
