import Link from "next/link";

type Locale = "en" | "ar";

type FooterProps = {
  locale?: Locale;
};

const POLICY_LINKS = [
  { key: "terms", href: "/terms", en: "Terms & Conditions", ar: "الشروط والأحكام" },
  { key: "shipping", href: "/shipping", en: "Shipping Policy", ar: "سياسة الشحن" },
  { key: "returns", href: "/returns", en: "Returns & Exchanges", ar: "الاستبدال والاسترجاع" },
  { key: "privacy", href: "/privacy", en: "Privacy Policy", ar: "سياسة الخصوصية" },
  { key: "compliance", href: "/compliance", en: "Quality & Compliance", ar: "الجودة والالتزام" },
] as const;

export default function Footer({ locale = "en" }: FooterProps) {
  const isAr = locale === "ar";
  const href = (path: string) => `/${locale}${path}`;

  return (
    <footer className="site-footer" aria-label={isAr ? "تذييل الموقع" : "Site footer"}>
      <div className="shell" style={{ display: "grid", gap: "1rem" }}>
        <div className="panel" style={{ padding: ".9rem" }}>
          <div style={{ display: "flex", gap: ".6rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <strong>{isAr ? "نيفـران" : "NIVRAN"}</strong>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                {isAr ? "الاسم القانوني: Nivran Fragrance" : "Legal entity: Nivran Fragrance"}
              </p>
            </div>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <a className="btn" href="mailto:hello@nivran.com">hello@nivran.com</a>
              <a className="btn" href="https://wa.me/962791752686" target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: ".9rem", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <section className="panel" style={{ padding: ".9rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: ".5rem", fontSize: "1rem" }}>{isAr ? "السياسات" : "Policies"}</h3>
            <div style={{ display: "grid", gap: ".35rem" }}>
              {POLICY_LINKS.map((link) => (
                <Link key={link.key} href={href(link.href)} className="muted" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                  {isAr ? link.ar : link.en}
                </Link>
              ))}
            </div>
          </section>

          <section className="panel" style={{ padding: ".9rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: ".5rem", fontSize: "1rem" }}>{isAr ? "التواصل" : "Contact"}</h3>
            <div className="muted" style={{ display: "grid", gap: ".35rem" }}>
              <a href="mailto:hello@nivran.com">hello@nivran.com</a>
              <a href="tel:+962791752686">+962791752686</a>
              <a href="https://wa.me/962791752686" target="_blank" rel="noreferrer">
                {isAr ? "راسلنا على واتساب" : "Chat on WhatsApp"}
              </a>
            </div>
          </section>

          <section className="panel" style={{ padding: ".9rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: ".5rem", fontSize: "1rem" }}>{isAr ? "الشركة" : "Company"}</h3>
            <div className="muted" style={{ display: "grid", gap: ".35rem" }}>
              <div>{isAr ? "الكيان القانوني: Nivran Fragrance" : "Legal entity: Nivran Fragrance"}</div>
              <div>© {new Date().getFullYear()} NIVRAN · Jordan</div>
              <div>
                {isAr
                  ? "قد تتغير إتاحة المنتجات والسياسات. راجع صفحات السياسات للتفاصيل."
                  : "Product availability and policies may change. See policy pages for details."}
              </div>
            </div>
          </section>
        </div>
      </div>
    </footer>
  );
}
