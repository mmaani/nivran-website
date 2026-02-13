const LINKS = {
  en: {
    home: "Home",
    story: "Story",
    faq: "FAQ",
    contact: "Contact",
    product: "Product",
    shipping: "Shipping",
    returns: "Returns",
    privacy: "Privacy",
    terms: "Terms",
    compliance: "Compliance",
    cart: "Cart",
    checkout: "Checkout",
  },
  ar: {
    home: "الرئيسية",
    story: "القصة",
    faq: "الأسئلة",
    contact: "تواصل",
    product: "المنتج",
    shipping: "الشحن",
    returns: "الاستبدال/الاسترجاع",
    privacy: "الخصوصية",
    terms: "الشروط",
    compliance: "التنبيهات",
    cart: "السلة",
    checkout: "الدفع",
  },
};

export default async function StoreLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const t = LINKS[locale];

  const href = (p: string) => `/${locale}${p}`;

  return (
    <div lang={locale} dir={isAr ? "rtl" : "ltr"} style={{ minHeight: "100vh", fontFamily: "system-ui" }}>
      <header style={{ borderBottom: "1px solid #eee" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <a href={href("")} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.6 }}>
              {isAr ? "نيفـران" : "NIVRAN"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {isAr ? "ارتدِ الهدوء" : "Wear the calm."}
            </div>
          </a>

          <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", marginInlineStart: isAr ? 0 : "auto", marginInlineEnd: isAr ? "auto" : 0 }}>
            <a href={href("")} style={{ textDecoration: "underline" }}>{t.home}</a>
            <a href={href("/story")} style={{ textDecoration: "underline" }}>{t.story}</a>
            <a href={href("/product/nivran-calm-100ml")} style={{ textDecoration: "underline" }}>{t.product}</a>
            <a href={href("/faq")} style={{ textDecoration: "underline" }}>{t.faq}</a>
            <a href={href("/contact")} style={{ textDecoration: "underline" }}>{t.contact}</a>
            <a href={href("/cart")} style={{ textDecoration: "underline" }}>{t.cart}</a>
            <a href={href("/checkout")} style={{ textDecoration: "underline" }}>{t.checkout}</a>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "18px" }}>
        {children}
      </main>

      <footer style={{ borderTop: "1px solid #eee", marginTop: 20 }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px 18px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            © {new Date().getFullYear()} {isAr ? "نيفـران" : "NIVRAN"} — {isAr ? "ارتدِ الهدوء" : "Wear the calm."}
          </div>

          <div style={{ marginInlineStart: isAr ? 0 : "auto", marginInlineEnd: isAr ? "auto" : 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={href("/shipping")} style={{ textDecoration: "underline", fontSize: 12 }}>{t.shipping}</a>
            <a href={href("/returns")} style={{ textDecoration: "underline", fontSize: 12 }}>{t.returns}</a>
            <a href={href("/privacy")} style={{ textDecoration: "underline", fontSize: 12 }}>{t.privacy}</a>
            <a href={href("/terms")} style={{ textDecoration: "underline", fontSize: 12 }}>{t.terms}</a>
            <a href={href("/compliance")} style={{ textDecoration: "underline", fontSize: 12 }}>{t.compliance}</a>
          </div>

          <div style={{ width: "100%", fontSize: 12, opacity: 0.65, marginTop: 6 }}>
            {isAr
              ? "تنبيه: نستخدم صياغة آمنة للادعاءات بدون أي ادعاءات طبية أو علاجية."
              : "Notice: claim-safe wording only — no medical or therapeutic claims."}
          </div>
        </div>
      </footer>
    </div>
  );
}
