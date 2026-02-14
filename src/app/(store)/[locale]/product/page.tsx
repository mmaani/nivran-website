import { categoryLabels, products } from "@/lib/siteContent";

export default async function ProductCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{isAr ? "المتجر" : "Shop"}</h1>
      <p className="lead" style={{ marginTop: 0 }}>
        {isAr
          ? "التركيز الأساسي لنيفـران هو العطور، مع التوسع التدريجي لفئات إضافية."
          : "NIVRAN is perfume-first, with gradual expansion into additional personal and home care categories."}
      </p>

      <div className="badge-row" style={{ marginBottom: ".8rem" }}>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <span key={key} className="badge">{label[locale]}</span>
        ))}
      </div>

      <div className="grid-3">
        {products.map((product) => (
          <article key={product.slug} className="panel">
            <p className="muted" style={{ marginTop: 0 }}>
              {categoryLabels[product.category][locale]} · {product.size}
            </p>
            <h3 style={{ margin: "0 0 .35rem" }}>{product.name[locale]}</h3>
            <p className="muted">{product.subtitle[locale]}</p>
            <p><strong>{product.priceJod.toFixed(2)} JOD</strong></p>
            <a className="btn" href={`/${locale}/product/${product.slug}`}>
              {isAr ? "عرض المنتج" : "View product"}
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
