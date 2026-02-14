import { notFound } from "next/navigation";
import { categoryLabels, products } from "@/lib/siteContent";

export default async function ProductPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  const related = products.filter((item) => item.slug !== product.slug && item.category === product.category).slice(0, 2);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <a href={`/${locale}/product`}>{isAr ? "← رجوع للمتجر" : "← Back to shop"}</a>
      <section className="panel" style={{ marginTop: ".7rem" }}>
        <p className="muted" style={{ marginTop: 0 }}>{categoryLabels[product.category][locale]} · {product.size}</p>
        <h1 className="title" style={{ marginTop: 0 }}>{product.name[locale]}</h1>
        <p>{product.subtitle[locale]}</p>
        <div className="grid-2">
          <article className="panel">
            <h3 style={{ marginTop: 0 }}>{isAr ? "تفاصيل المنتج" : "Product details"}</h3>
            <p>{product.description[locale]}</p>
            <p><strong>{product.priceJod.toFixed(2)} JOD</strong> · {product.size}</p>
            <p style={{ marginBottom: 0 }}>{isAr ? "النوتات" : "Notes"}: {product.notes[locale].join(" • ")}</p>
          </article>
          <article className="panel">
            <h3 style={{ marginTop: 0 }}>{isAr ? "تفاصيل المنتج" : "Product details"}</h3>
            <p>{product.description[locale]}</p>
            <p style={{ marginBottom: 4 }}>{isAr ? "النوتات" : "Notes"}: {product.notes[locale].join(" • ")}</p>
            <p className="muted" style={{ marginTop: 0 }}>{isAr ? "الأحجام" : "Variants"}</p>
            <ul>
              {product.variants.map((v) => (
                <li key={v.id}>{v.sizeLabel} — <strong>{v.priceJod.toFixed(2)} JOD</strong></li>
              ))}
            </ul>
            <p className="muted" style={{ marginBottom: 0 }}>
              {isAr ? "شحن لجميع مناطق الأردن • رسوم ثابتة 3.5 دينار" : "Nationwide Jordan • Flat 3.5 JOD"}
            </p>
            <p style={{ marginTop: 6 }}>
              <a style={{ textDecoration: "underline" }} href={`/${locale}/returns`}>{isAr ? "سياسة الإرجاع" : "Returns policy"}</a>
            </p>
          </article>
        </div>
        <div className="cta-row" style={{ marginTop: "1rem" }}>
          <a className="btn primary" href={`/${locale}/checkout`}>{isAr ? "اشترِ الآن" : "Buy now"}</a>
          <a className="btn" href={`/${locale}/faq`}>{isAr ? "الأسئلة الشائعة" : "FAQ"}</a>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section">
          <h2 className="section-title">{isAr ? "منتجات مشابهة" : "Related products"}</h2>
          <div className="grid-2">
            {related.map((item) => (
              <article key={item.slug} className="panel">
                <h3 style={{ marginTop: 0 }}>{item.name[locale]}</h3>
                <p className="muted">{item.subtitle[locale]}</p>
                <a className="btn" href={`/${locale}/product/${item.slug}`}>{isAr ? "عرض المنتج" : "View product"}</a>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
