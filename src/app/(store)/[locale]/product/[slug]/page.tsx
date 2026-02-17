import ProductImageGallery from "./ProductImageGallery";
import ProductPurchasePanel from "./ProductPurchasePanel";
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
  inventory_qty: number;
  category_key: string;
  is_active: boolean;
};
type VariantRow = { id: number; label: string; price_jod: string; compare_at_price_jod: string | null; is_default: boolean; is_active: boolean; sort_order: number };
type TagRow = { wear_times: string[] | null; seasons: string[] | null; audiences: string[] | null };

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
    `select p.id,
            p.slug,
            p.name_en,
            p.name_ar,
            p.description_en,
            p.description_ar,
            p.price_jod::text as price_jod,
            p.compare_at_price_jod::text as compare_at_price_jod,
            p.inventory_qty,
            p.category_key,
            p.is_active
       from products p
      where p.slug=$1
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



  const variantsRes = await db.query<VariantRow>(
    `select id, label, price_jod::text as price_jod, compare_at_price_jod::text as compare_at_price_jod, is_default, is_active, sort_order
       from product_variants
      where product_id=$1 and is_active=true
      order by is_default desc, sort_order asc, price_jod asc, id asc`,
    [product.id]
  );

  const tagsRes = await db.query<TagRow>(`select wear_times, seasons, audiences from product_tags where product_id=$1 limit 1`, [product.id]);
  const name = isAr ? product.name_ar : product.name_en;
  const desc = isAr ? product.description_ar : product.description_en;
  const catLabel = cat ? (isAr ? cat.name_ar : cat.name_en) : product.category_key;

  const outOfStock = Number(product.inventory_qty || 0) <= 0;

  const imageUrls = imgs.rows.map((img) => `/api/catalog/product-image/${img.id}`);
  const fallbackSrc = fallbackFromSlug(product.slug);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <p className="muted" style={{ marginTop: 0 }}>
        {catLabel}
      </p>

      <div className={styles.grid2} style={{ alignItems: "start" }}>
        <div style={{ position: "relative" }}>
          <ProductImageGallery name={name} images={imageUrls} fallbackSrc={fallbackSrc} />
          
        </div>

        <div>
          <h1 className="title" style={{ marginTop: 0 }}>
            {name}
          </h1>


          {outOfStock ? <p className="muted">{isAr ? "غير متوفر حالياً." : "Currently out of stock."}</p> : null}

          {desc ? <p className="muted">{desc}</p> : null}

          <ProductPurchasePanel
            locale={locale}
            slug={product.slug}
            name={name}
            variants={variantsRes.rows.map((v) => ({ id: v.id, label: v.label, priceJod: Number(v.price_jod || 0), compareAtPriceJod: v.compare_at_price_jod ? Number(v.compare_at_price_jod) : null }))}
            defaultVariantId={variantsRes.rows.find((v) => v.is_default)?.id || variantsRes.rows[0]?.id || null}
            outOfStock={outOfStock}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {([...(tagsRes.rows[0]?.wear_times || []), ...(tagsRes.rows[0]?.seasons || []), ...(tagsRes.rows[0]?.audiences || [])]).map((tag) => (
              <span key={tag} className="badge">{tag}</span>
            ))}
          </div>

          <a className="btn btn-outline" href={`/${locale}/product`} style={{ marginTop: 12, display: "inline-flex" }}>
            {isAr ? "العودة للمتجر" : "Back to shop"}
          </a>
        </div>
      </div>
    </div>
  );
}
