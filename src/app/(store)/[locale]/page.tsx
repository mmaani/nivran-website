import {
  benefits,
  categoryLabels,
  featuredProduct,
  mainProductMessage,
  products,
  testimonials,
  type ProductCategory,
  type Product,
} from "@/lib/siteContent";
import type { Locale } from "@/lib/locale";
import { getHomeCopy } from "@/lib/homeCopy";
import QuickFactsRotator from "./QuickFactsRotator";

const fallbackCategoryLabels: Record<string, Record<Locale, string>> = {
  perfume: { en: "Perfume", ar: "عطور" },
  "hand-gel": { en: "Hand Gel", ar: "جل يدين" },
  cream: { en: "Cream", ar: "كريم" },
  "air-freshener": { en: "Air Freshener", ar: "معطر جو" },
  soap: { en: "Soap", ar: "صابون" },
};

type BenefitItem = { title: string; body: string };
type TestimonialItem = { name: string; text: string };

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const localizedBenefits = (benefits[locale] || []) as BenefitItem[];
  const localizedTestimonials = (testimonials[locale] || []) as TestimonialItem[];
  const productList: Product[] = products || [];
  const heroNotes = (featuredProduct.notes?.[locale] || []).slice(0, 6);
  const categoryLabelMap: Record<string, Record<Locale, string>> =
    categoryLabels || fallbackCategoryLabels;
  const minPriceByCategory = productList.reduce<Record<string, number>>((acc, item) => {
    const current = acc[item.category];
    acc[item.category] = typeof current === "number" ? Math.min(current, item.priceJod) : item.priceJod;
    return acc;
  }, {});

  const t = getHomeCopy(locale);

  const quickFacts = [
    { title: t.madeJordan, body: t.madeJordanBody },
    { title: t.edpFocus, body: t.edpFocusBody },
    { title: t.fastDelivery, body: t.fastDeliveryBody },
    { title: t.premiumAccess, body: t.premiumAccessBody },
    { title: t.cleanLineup, body: t.cleanLineupBody },
  ];

  const spotlightCategories: Array<{ key: ProductCategory; desc: string }> = [
    { key: "perfume", desc: t.perfumeDesc },
    { key: "cream", desc: t.creamDesc },
    { key: "hand-gel", desc: t.handGelDesc },
  ];


  if (!featuredProduct) return null;

  return (
    <div>
      <section className="hero-shell">
        <div className="hero-grid">
          <article className="hero-card hero-card-dynamic">
            <div className="hero-ambient" aria-hidden>
              <span className="hero-orb orb-a" />
              <span className="hero-orb orb-b" />
              <span className="hero-orb orb-c" />
            </div>
            <span className="kicker">{isAr ? "دار عطور أردنية" : "Jordanian perfume house"}</span>
            <h1 className="title">{t.hero}</h1>
            <p className="lead">{t.sub}</p>
            <div className="hero-marquee" aria-label={t.trail}>
              <div className="hero-marquee-track">
                {[...heroNotes, ...heroNotes].map((note, idx) => (
                  <span className="badge" key={`${note}-${idx}`}>{note}</span>
                ))}
              </div>
            </div>
            <div className="cta-row">
              <a className="btn primary" href={`/${locale}/product/${featuredProduct.slug}`}>{t.explore}</a>
              <a className="btn" href={`/${locale}/checkout`}>{t.checkout}</a>
              <a className="btn ghost" href={`/${locale}/story`}>{t.story}</a>
            </div>
          </article>

          <aside className="feature-card">
            <p className="muted" style={{ marginTop: 0 }}>{t.quick}</p>
            <QuickFactsRotator facts={quickFacts} dotsLabel={t.factsControls} />
            <h3 style={{ margin: "0 0 .3rem" }}>{featuredProduct.name[locale]}</h3>
            <p className="muted" style={{ marginTop: 0 }}>{featuredProduct.subtitle[locale]}</p>
            <p style={{ marginBottom: ".45rem" }}><strong>{featuredProduct.priceJod.toFixed(2)} JOD</strong> · {featuredProduct.size}</p>
            <p className="muted" style={{ margin: 0 }}>{featuredProduct.description[locale]}</p>
            <div className="badge-row">
              {(featuredProduct.notes?.[locale] || []).map((n: string) => <span className="badge" key={n}>{n}</span>)}
            </div>
          </aside>
        </div>
      </section>

      <section className="section">
        <article className="panel campaign-strip">
          <p className="campaign-text">{t.campaign}</p>
          <p className="muted" style={{ margin: 0 }}>{t.campaignHint}</p>
        </article>
      </section>

      <section className="section">
        <h2 className="section-title">{t.editorialCategories}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{t.categories}</p>
        <div className="grid-3">
          {spotlightCategories.map((item) => (
            <article key={item.key} className="panel category-editorial-card lift-panel">
              <p className="kicker" style={{ marginBottom: ".55rem" }}>{categoryLabelMap[item.key][locale]}</p>
              <p className="muted" style={{ marginTop: 0 }}>{item.desc}</p>
              <p style={{ margin: "0 0 .75rem" }}>
                <strong>{(minPriceByCategory[item.key] || 0).toFixed(2)} JOD</strong>
              </p>
              <a className="btn" href={`/${locale}/product`}>{t.catalog}</a>
            </article>
          ))}
        </div>
        <div className="cta-row" style={{ marginTop: ".8rem" }}>
          <a className="btn ghost" href={`/${locale}/product`}>{t.viewAllCategories}</a>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.featuredProducts}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{mainProductMessage[locale]}</p>
        <div className="grid-3">
          {productList.slice(0, 6).map((item) => (
            <article key={item.slug} className="panel lift-panel">
              <p className="muted" style={{ marginTop: 0 }}>{(categoryLabelMap[item.category] || fallbackCategoryLabels[item.category])[locale]} · {item.size}</p>
              <h3 style={{ margin: "0 0 .3rem" }}>{item.name[locale]}</h3>
              <p className="muted">{item.subtitle[locale]}</p>
              <p style={{ marginBottom: 0 }}><strong>{item.priceJod.toFixed(2)} JOD</strong></p>
            </article>
          ))}
        </div>
        <div className="cta-row" style={{ marginTop: ".8rem" }}>
          <a className="btn" href={`/${locale}/product`}>{t.catalog}</a>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">{t.why}</h2>
        <div className="grid-3">
          {localizedBenefits.map((item) => (
            <article key={item.title} className="panel lift-panel">
              <h3 style={{ marginTop: 0 }}>{item.title}</h3>
              <p style={{ marginBottom: 0 }} className="muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section grid-2">
        <article className="panel">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.6rem" }}>{t.proof}</h2>
          {localizedTestimonials.map((item) => (
            <div key={item.name} className="review">
              “{item.text}”
              <div className="muted">— {item.name}</div>
            </div>
          ))}
        </article>

        <article className="panel">
          <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.6rem" }}>{t.newsletter}</h2>
          <form action="/api/newsletter" method="post" style={{ display: "grid", gap: ".6rem" }}>
            <input className="input" required type="email" name="email" placeholder={t.email} />
            <input type="hidden" name="locale" value={locale} />
            <button className="btn primary" type="submit">{t.join}</button>
          </form>
        </article>
      </section>
    </div>
  );
}
