import Link from "next/link";
import Image from "next/image";
import CartHeaderIcon from "@/components/CartHeaderIcon";
import CartHydrator from "@/components/CartHydrator";
import LocaleSwitchLink from "@/components/site/LocaleSwitchLink";
import Footer from "@/components/site/Footer";
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



  return (
    <div lang={locale} dir={isAr ? "rtl" : "ltr"}>
      <CartHydrator />
      <header className="site-header" style={{ position: "relative" }}>
        <div className="shell topbar">
          <a className="brand" href={href("")} style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
            <Image src="/brand/logo.svg" alt="NIVRAN" width={44} height={44} style={{ borderRadius: "50%", border: "1px solid rgba(200,163,100,.6)" }} />
            <span style={{ display: "inline-grid" }}>
              <strong>{isAr ? "نيفـران" : "NIVRAN"}</strong>
              <span>{isAr ? "ارتدِ الهدوء" : "Wear the calm."}</span>
            </span>
          </a>

          <nav className="main-nav desktop-nav">
            <a href={href("")}>{t.home}</a>
            <a href={href("/story")}>{t.story}</a>
            <a href={href("/product")}>{t.product}</a>
            <a href={href("/faq")}>{t.faq}</a>
            <a href={href("/contact")}>{t.contact}</a>
            <a className="nav-cta" href={href("/checkout")}>{t.checkout}</a>
            <a href={href("/account")}>{t.account}</a>
            <LocaleSwitchLink locale={locale} label={t.lang} />
            <Link href="/admin/orders">{t.admin}</Link>
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
              <LocaleSwitchLink locale={locale} label={t.lang} />
              <Link href="/admin/orders">{t.admin}</Link>
            </div>
          </details>
        </div>
              <div style={{ position: "absolute", top: 10, insetInlineEnd: 12 }}>
          <CartHeaderIcon />
        </div>
</header>

      <main className="shell">{children}</main>

      <Footer locale={locale} />
    </div>
  );
}
