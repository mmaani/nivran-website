"use client";

import { useMemo, useState } from "react";
import SafeImg from "@/components/SafeImg";
import AddToCartButton from "@/components/AddToCartButton";

type Locale = "en" | "ar";

type ProductCard = {
  slug: string;
  name: string;
  description: string;
  categoryKey: string;
  categoryLabel: string;
  inventoryQty: number;
  fromPrice: number;
  defaultVariantId: number | null;
  defaultVariantLabel: string;
  defaultVariantPrice: number;
  hasPromo: boolean;
  promoType: "PERCENT" | "FIXED" | null;
  promoValue: number;
  discountedPrice: number | null;
  imageSrc: string;
  fallbackSrc: string;
  tags: string[];
};

type CategoryOption = { key: string; label: string };
type SortKey = "recommended" | "price-asc" | "price-desc" | "name";

function promoBadgeText(locale: Locale, promoType: string | null, promoValue: number): string {
  if (promoType === "PERCENT") {
    return locale === "ar" ? `AUTO • وفر ${promoValue}%` : `AUTO • Save ${promoValue}%`;
  }
  return locale === "ar" ? `AUTO • وفر ${promoValue.toFixed(2)} د.أ` : `AUTO • Save ${promoValue.toFixed(2)} JOD`;
}

function normalizeText(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export default function ProductGridClient({
  locale,
  categories,
  products,
}: {
  locale: Locale;
  categories: CategoryOption[];
  products: ProductCard[];
}) {
  const isAr = locale === "ar";
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [visibleCount, setVisibleCount] = useState(12);

  const filtered = useMemo(() => {
    const keyword = normalizeText(search);
    const list = products.filter((item) => {
      if (selectedCategory !== "all" && item.categoryKey !== selectedCategory) return false;
      if (!keyword) return true;
      const haystack = [item.name, item.description, item.tags.join(" "), item.categoryLabel]
        .map(normalizeText)
        .join(" ");
      return haystack.includes(keyword);
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "price-asc") return a.fromPrice - b.fromPrice;
      if (sort === "price-desc") return b.fromPrice - a.fromPrice;
      if (sort === "name") return a.name.localeCompare(b.name, locale === "ar" ? "ar" : "en");
      if (a.hasPromo !== b.hasPromo) return a.hasPromo ? -1 : 1;
      return a.fromPrice - b.fromPrice;
    });

    return sorted;
  }, [products, search, selectedCategory, sort, locale]);

  const visible = filtered.slice(0, visibleCount);
  const canLoadMore = visible.length < filtered.length;

  return (
    <>
      <section className="panel" style={{ marginBottom: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <label>
            {isAr ? "بحث" : "Search"}
            <input
              className="input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(12);
              }}
              placeholder={isAr ? "اسم المنتج، الفئة، أو الوسم" : "Product name, category, or tag"}
            />
          </label>

          <label>
            {isAr ? "الفئة" : "Category"}
            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setVisibleCount(12);
              }}
            >
              <option value="all">{isAr ? "كل الفئات" : "All categories"}</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {isAr ? "الترتيب" : "Sort"}
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="recommended">{isAr ? "موصى به" : "Recommended"}</option>
              <option value="price-asc">{isAr ? "السعر: الأقل للأعلى" : "Price: low to high"}</option>
              <option value="price-desc">{isAr ? "السعر: الأعلى للأقل" : "Price: high to low"}</option>
              <option value="name">{isAr ? "الاسم" : "Name"}</option>
            </select>
          </label>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          {isAr ? `عرض ${visible.length} من ${filtered.length} منتج` : `Showing ${visible.length} of ${filtered.length} products`}
        </p>
      </section>

      <div className="grid-3">
        {visible.map((p) => {
          const outOfStock = Number(p.inventoryQty || 0) <= 0;
          return (
            <article key={p.slug} className="panel">
              <p className="muted" style={{ marginTop: 0 }}>
                {p.categoryLabel}
                {outOfStock ? (isAr ? " · غير متوفر" : " · Out of stock") : ""}
              </p>

              <div
                style={{
                  position: "relative",
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
                  src={p.imageSrc}
                  fallbackSrc={p.fallbackSrc}
                  alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  loading="lazy"
                  sizes="(max-width: 900px) 100vw, (max-width: 1400px) 50vw, 33vw"
                />
                {p.hasPromo ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      insetInlineStart: 10,
                      background: "linear-gradient(135deg, #141414, #2a2622)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {promoBadgeText(locale, p.promoType, p.promoValue)}
                  </div>
                ) : null}
              </div>

              <h3 style={{ margin: "0 0 .35rem" }}>{p.name}</h3>
              {p.description ? <p className="muted">{p.description}</p> : null}

              <p style={{ marginBottom: 4 }}>
                <strong>{isAr ? `ابتداءً من ${p.fromPrice.toFixed(2)} JOD` : `From ${p.fromPrice.toFixed(2)} JOD`}</strong>
              </p>
              <p className="muted" style={{ marginTop: 0 }}>
                {p.hasPromo && p.discountedPrice != null
                  ? isAr
                    ? `السعر الحالي (${p.defaultVariantLabel || "Default"}): ${p.discountedPrice.toFixed(2)} JOD`
                    : `Current price (${p.defaultVariantLabel || "Default"}): ${p.discountedPrice.toFixed(2)} JOD`
                  : isAr
                    ? `السعر الحالي (${p.defaultVariantLabel || "Default"}): ${p.defaultVariantPrice.toFixed(2)} JOD`
                    : `Current price (${p.defaultVariantLabel || "Default"}): ${p.defaultVariantPrice.toFixed(2)} JOD`}
              </p>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {p.tags.slice(0, 2).map((chip) => (
                  <span key={`${p.slug}-${chip}`} className="badge" style={{ fontSize: 11, padding: "2px 8px" }}>
                    {chip}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <a className="btn" href={`/${locale}/product/${p.slug}`}>
                  {isAr ? "عرض المنتج" : "View product"}
                </a>

                <AddToCartButton
                  locale={locale}
                  slug={p.slug}
                  name={p.name}
                  variantId={p.defaultVariantId}
                  variantLabel={p.defaultVariantLabel}
                  priceJod={p.defaultVariantPrice}
                  label={outOfStock ? (isAr ? "غير متوفر" : "Out of stock") : isAr ? "أضف إلى السلة" : "Add to cart"}
                  addedLabel={isAr ? "تمت الإضافة ✓" : "Added ✓"}
                  updatedLabel={isAr ? "تم التحديث ✓" : "Updated ✓"}
                  className={"btn btn-outline" + (outOfStock ? " btn-disabled" : "")}
                  disabled={outOfStock}
                />
              </div>
            </article>
          );
        })}
      </div>

      {canLoadMore ? (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="btn" type="button" onClick={() => setVisibleCount((v) => v + 12)}>
            {isAr ? "عرض المزيد" : "Load more"}
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>
          {isAr ? "لا توجد نتائج مطابقة. جرّب تغيير الفلاتر." : "No matching products found. Try adjusting your filters."}
        </p>
      ) : null}
    </>
  );
}
