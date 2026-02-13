import { featuredProduct } from "@/lib/siteContent";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <a href={`/${locale}`}>{isAr ? "← رجوع" : "← Back"}</a>
      <section className="panel" style={{ marginTop: ".7rem" }}>
        <h1 className="title" style={{ marginTop: 0 }}>{featuredProduct.name[locale]}</h1>
        <p>{featuredProduct.subtitle[locale]}</p>
        <div className="grid-2">
          <article className="panel">
            <h3 style={{ marginTop: 0 }}>{isAr ? "تفاصيل المنتج" : "Product details"}</h3>
            <p>{featuredProduct.description[locale]}</p>
            <p><strong>{featuredProduct.priceJod.toFixed(2)} JOD</strong> · {featuredProduct.size}</p>
            <p style={{ marginBottom: 0 }}>{isAr ? "النوتات" : "Notes"}: {featuredProduct.notes[locale].join(" • ")}</p>
          </article>
          <article className="panel">
            <h3 style={{ marginTop: 0 }}>{isAr ? "الاستخدام الآمن" : "Safe usage"}</h3>
            <ul style={{ marginBottom: 0 }}>
              <li>{isAr ? "للاستخدام الخارجي فقط." : "For external use only."}</li>
              <li>{isAr ? "يحفظ بعيدًا عن الحرارة واللهب." : "Keep away from heat and flame."}</li>
              <li>{isAr ? "لا توجد ادعاءات علاجية." : "No therapeutic claims are made."}</li>
            </ul>
          </article>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="btn primary" href={`/${locale}/checkout`}>{isAr ? "اشترِ الآن" : "Buy now"}</a>
          <a className="btn" href={`/${locale}/faq`}>{isAr ? "الأسئلة الشائعة" : "FAQ"}</a>
        </div>
      </section>
    </div>
  );
}
