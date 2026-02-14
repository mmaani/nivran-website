import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categoryLabels, defaultVariant, products } from "@/lib/siteContent";

type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const product = products.find((item) => item.slug === slug);
  if (!product) return {};
  const v = defaultVariant(product);

  const title = `${product.name[locale]} | NIVRAN`;
  const description = `${product.subtitle[locale]} — ${v.priceJod.toFixed(2)} JOD`;
  const image = product.images[0] || "/products/calm-1.svg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  const related = products.filter((item) => item.slug !== product.slug && item.category === product.category).slice(0, 2);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nivran.com";
  const canonical = `${baseUrl}/${locale}/product/${product.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name[locale],
    description: product.description[locale],
    image: product.images.map((i) => `${baseUrl}${i}`),
    brand: { "@type": "Brand", name: "NIVRAN" },
    category: categoryLabels[product.category].en,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      priceCurrency: "JOD",
      price: v.priceJod.toFixed(2),
      availability: v.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: canonical,
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: 3.5, currency: "JOD" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "JO" },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "JO",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    })),
  };

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <a href={`/${locale}/product`}>{isAr ? "← رجوع للمتجر" : "← Back to shop"}</a>
      <section className="panel" style={{ marginTop: ".7rem" }}>
        <p className="muted" style={{ marginTop: 0 }}>{categoryLabels[product.category][locale]}</p>
        <h1 className="title" style={{ marginTop: 0 }}>{product.name[locale]}</h1>
        <p>{product.subtitle[locale]}</p>
        <div className="grid-2">
          <article className="panel">
            <Image
              src={product.images[0]}
              alt={product.name[locale]}
              width={900}
              height={900}
              style={{ width: "100%", height: "auto", borderRadius: 12, marginBottom: 10 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 6 }}>
              {product.images.slice(0, 5).map((src) => (
                <Image key={src} src={src} alt={product.name[locale]} width={180} height={180} style={{ width: "100%", height: "auto", borderRadius: 8 }} />
              ))}
            </div>
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
