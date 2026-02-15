import SafeImg from "@/components/SafeImg";
import AddToCartButton from "@/components/AddToCartButton";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

type CategoryRow = {
  key: string;
  name_en: string;
  name_ar: string;
  is_active: boolean;
  is_promoted: boolean;
  sort_order: number;
};

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price_jod: string;
  category_key: string;
  inventory_qty: number;
  image_id: number | null;
};

const FALLBACK_CATS: Record<string, { en: string; ar: string }> = {
  perfume: { en: "Perfume", ar: "عطر" },
  "hand-gel": { en: "Hand Gel", ar: "معقم يدين" },
  cream: { en: "Cream", ar: "كريم" },
  "air-freshener": { en: "Air Freshener", ar: "معطر جو" },
  soap: { en: "Soap", ar: "صابون" },
};

function fallbackFromSlug(slug: string) {
  const s = String(slug || "").toLowerCase();
  const family = s.includes("noir") ? "noir" : s.includes("bloom") ? "bloom" : "calm";
  return `/products/${family}-1.svg`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  await ensureCatalogTables();

  const categoriesRes = await db.query<CategoryRow>(
    `select key, name_en, name_ar, is_active, is_promoted, sort_order
       from categories
      where is_active=true
      order by sort_order asc, key asc`
  );

  const productsRes = await db.query<ProductRow>(
    `select p.id,
            p.slug,
            p.name_en,
            p.name_ar,
            p.description_en,
            p.description_ar,
            p.price_jod::text as price_jod,
            p.category_key,
            p.inventory_qty,
            (
              select pi.id
              from product_images pi
              where pi.product_id=p.id
              order by pi."position" asc, pi.id asc
              limit 1
            ) as image_id
       from products p
      where p.is_active=true
      order by p.created_at desc
      limit 500`
  );

  const cats = categoriesRes.rows.length
    ? categoriesRes.rows.map((c) => ({
        key: c.key,
        label: locale === "ar" ? c.name_ar : c.name_en,
      }))
    : Object.entries(FALLBACK_CATS).map(([key, v], i) => ({
        key,
        label: (v as any)[locale],
        sort: i,
      }));

  const catLabel = (key: string) => {
    const found = categoriesRes.rows.find((c) => c.key === key);
    if (found) return locale === "ar" ? found.name_ar : found.name_en;
    return (FALLBACK_CATS[key] || { en: key, ar: key })[locale];
  };

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{isAr ? "المتجر" : "Shop"}</h1>
      <p className="lead" style={{ marginTop: 0 }}>
        {isAr
          ? "تصفح منتجات نيفـران عبر فئات متعددة — العطور أولاً ثم التوسع لفئات العناية الشخصية والمنزلية."
          : "Browse NIVRAN products across multiple categories — perfume-first, with expansion into personal & home care."}
      </p>

      <div className="badge-row" style={{ marginBottom: ".8rem" }}>
        {cats.map((c: any) => (
          <span key={c.key} className="badge">
            {c.label}
          </span>
        ))}
      </div>

      <div className="grid-3">
        {productsRes.rows.map((p) => {
          const name = isAr ? p.name_ar : p.name_en;
          const desc = isAr ? p.description_ar : p.description_en;
          const price = Number(p.price_jod || 0);

          const apiSrc = p.image_id ? `/api/catalog/product-image/${p.image_id}` : "";
          const fallbackSrc = fallbackFromSlug(p.slug);
          const imgSrc = apiSrc || fallbackSrc;

          return (
            <article key={p.slug} className="panel">
              <p className="muted" style={{ marginTop: 0 }}>
                {catLabel(p.category_key)}
                {p.inventory_qty <= 0 ? (isAr ? " · غير متوفر" : " · Out of stock") : ""}
              </p>

              <div
                style={{
                  width: "100%",
                  aspectRatio: "4 / 3",
                  overflow: "hidden",
                  borderRadius: 14,
                  marginBottom: 10,
                  background: "#f7f7f8",
                  border: "1px solid #eee",
                }}
              >
                <SafeImg
                  src={imgSrc}
                  fallbackSrc={fallbackSrc}
                  alt={name}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  loading="lazy"
                />
              </div>

              <h3 style={{ margin: "0 0 .35rem" }}>{name}</h3>
              {desc ? <p className="muted">{desc}</p> : null}

              <p>
                <strong>{price.toFixed(2)} JOD</strong>
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <a className="btn" href={`/${locale}/product/${p.slug}`}>
                  {isAr ? "عرض المنتج" : "View product"}
                </a>

                <AddToCartButton
                  locale={locale}
                  slug={p.slug}
                  name={name}
                  priceJod={price}
                  label={isAr ? "أضف إلى السلة" : "Add to cart"}
                  className="btn btn-outline"
                />
              </div>
            </article>
          );
        })}
      </div>

      {productsRes.rows.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          {isAr ? "لا توجد منتجات بعد. أضف المنتجات من لوحة الإدارة." : "No products yet. Add products from Admin."}
        </p>
      ) : null}
    </div>
  );
}
