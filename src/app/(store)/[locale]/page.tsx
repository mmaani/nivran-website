import {
  benefits,
  categoryLabels,
  featuredProduct,
  mainProductMessage,
  products,
  testimonials,
  type Locale,
  type Product,
} from "@/lib/siteContent";

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
  const categoryLabelMap: Record<string, Record<Locale, string>> =
    categoryLabels || fallbackCategoryLabels;

  const t = {
    en: {
      hero: "Elegant fragrance shopping with a luxury feel and local simplicity.",
      sub: "Discover NIVRAN Calm — our signature scent made for confident, modern daily wear.",
      explore: "Explore the scent",
      checkout: "Start checkout",
      story: "Read our story",
      why: "Why NIVRAN feels premium",
      proof: "Loved by customers",
      newsletter: "Members-only launch offers",
      email: "Your email",
      join: "Join now",
      quick: "Quick facts",
      categories: "Categories",
      catalog: "Browse catalog",
      perfumeFocus: "Perfume focus",
    },
    ar: {
      hero: "تجربة تسوق عطور أنيقة بطابع فاخر وسهولة محلية.",
      sub: "اكتشف نيفـران كالم — عطرنا الأساسي لإطلالة يومية واثقة وعصرية.",
      explore: "استكشف العطر",
      checkout: "ابدأ الدفع",
      story: "اقرأ قصتنا",
      why: "لماذا تبدو نيفـران فاخرة",
      proof: "آراء العملاء",
      newsletter: "عروض حصرية للمشتركين",
      email: "بريدك الإلكتروني",
      join: "اشترك الآن",
      quick: "معلومات سريعة",
      categories: "الفئات",
      catalog: "تصفح المنتجات",
      perfumeFocus: "تركيزنا على العطور",
    },
  }[locale];

  if (!featuredProduct) return null;

  return (
    <div>
      <section className="hero-shell">
        <div className="hero-grid">
          <article className="hero-card">
            <span className="kicker">{isAr ? "دار عطور أردنية" : "Jordanian perfume house"}</span>
            <h1 className="title">{t.hero}</h1>
            <p className="lead">{t.sub}</p>
            <div className="cta-row">
              <a className="btn primary" href={`/${locale}/product/${featuredProduct.slug}`}>{t.explore}</a>
              <a className="btn" href={`/${locale}/checkout`}>{t.checkout}</a>
              <a className="btn ghost" href={`/${locale}/story`}>{t.story}</a>
            </div>
          </article>

          <aside className="feature-card">
            <p className="muted" style={{ marginTop: 0 }}>{t.quick}</p>
            <div className="badge-row" style={{ marginBottom: ".6rem" }}>
              {Object.entries(categoryLabelMap).map(([key, label]) => (
                <span className="badge" key={key}>{label[locale]}</span>
              ))}
            </div>
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
        <h2 className="section-title">{t.categories}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{mainProductMessage[locale]}</p>
        <div className="grid-3">
          {productList.slice(0, 6).map((item) => (
            <article key={item.slug} className="panel">
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
            <article key={item.title} className="panel">
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
