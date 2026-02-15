import ProductImageGallery from "./ProductImageGallery";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fallbackFromSlug(slug: string) {
  const s = String(slug || "").toLowerCase();
  const family = s.includes("noir") ? "noir" : s.includes("bloom") ? "bloom" : "calm";
  return `/products/${family}-1.svg`;
}

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price_jod: string;
  compare_at_price_jod: string | null;
  inventory_qty: number;
  category_key: string;
  is_active: boolean;
};

type CategoryRow = { key: string; name_en: string; name_ar: string };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  await ensureCatalogTables();

  const pr = await db.query<ProductRow>(
    `select id, slug, name_en, name_ar, description_en, description_ar,
            price_jod::text as price_jod,
            compare_at_price_jod::text as compare_at_price_jod,
            inventory_qty, category_key, is_active
       from products
      where slug=$1
      limit 1`,
    [slug]
  );

  const product = pr.rows[0];
  if (!product || !product.is_active) return notFound();

  const cr = await db.query<CategoryRow>(
    `select key, name_en, name_ar
       from categories
      where key=$1
      limit 1`,
    [product.category_key]
  );
  const cat = cr.rows[0];

  const imgs = await db.query<{ id: number }>(
    `select id
       from product_images
      where product_id=$1
      order by "position" asc, id asc`,
    [product.id]
  );

  const name = isAr ? product.name_ar : product.name_en;
  const desc = isAr ? product.description_ar : product.description_en;
  const catLabel = cat ? (isAr ? cat.name_ar : cat.name_en) : product.category_key;

  const price = Number(product.price_jod || 0);
  const compareAt = product.compare_at_price_jod ? Number(product.compare_at_price_jod) : null;
  const outOfStock = Number(product.inventory_qty || 0) <= 0;

  const imageUrls = imgs.rows.map((img) => `/api/catalog/product-image/${img.id}`);
  const fallbackSrc = fallbackFromSlug(product.slug);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <p className="muted" style={{ marginTop: 0 }}>
        {catLabel}
      </p>

      <div className={styles.grid2} style={{ alignItems: "start" }}>
        <div>
          <ProductImageGallery name={name} images={imageUrls} fallbackSrc={fallbackSrc} />
        </div>

        <div>
          <h1 className="title" style={{ marginTop: 0 }}>
            {name}
          </h1>

          <p style={{ marginTop: 0 }}>
            {compareAt && compareAt > price ? (
              <>
                <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 10 }}>
                  {compareAt.toFixed(2)} JOD
                </span>
                <strong>{price.toFixed(2)} JOD</strong>
              </>
            ) : (
              <strong>{price.toFixed(2)} JOD</strong>
            )}
          </p>

          {outOfStock ? (
            <p className="muted">{isAr ? "غير متوفر حالياً." : "Currently out of stock."}</p>
          ) : null}

          {desc ? <p className="muted">{desc}</p> : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a className={"btn" + (outOfStock ? " btn-disabled" : "")} href={`/${locale}/checkout?slug=${product.slug}`}>
              {isAr ? "شراء الآن" : "Buy now"}
            </a>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {isAr ? "العودة للمتجر" : "Back to shop"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
