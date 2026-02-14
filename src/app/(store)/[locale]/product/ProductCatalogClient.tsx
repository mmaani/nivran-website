"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Locale, Product, ProductVariant, ScentFamily, Concentration } from "@/lib/siteContent";
import { categoryLabels, concentrationLabels, defaultVariant, minPrice, scentFamilyLabels } from "@/lib/siteContent";

type SortKey = "new" | "best" | "price-asc" | "price-desc";

function matchPrice(variant: ProductVariant, range: string) {
  const p = variant.priceJod;
  if (range === "0-10") return p <= 10;
  if (range === "10-20") return p > 10 && p <= 20;
  if (range === "20+") return p > 20;
  return true;
}

export default function ProductCatalogClient({ locale, initialProducts }: { locale: Locale; initialProducts: Product[] }) {
  const isAr = locale === "ar";
  const [sort, setSort] = useState<SortKey>("new");
  const [family, setFamily] = useState<ScentFamily | "all">("all");
  const [size, setSize] = useState<string>("all");
  const [concentration, setConcentration] = useState<Concentration | "all">("all");
  const [price, setPrice] = useState<string>("all");

  const products = useMemo(() => {
    const filtered = initialProducts.filter((p) => {
      if (family !== "all" && !p.scentFamily.includes(family)) return false;
      if (concentration !== "all" && p.concentration !== concentration) return false;
      const variants = p.variants.filter((v) => (size === "all" ? true : v.sizeLabel === size) && matchPrice(v, price));
      return variants.length > 0;
    });

    return filtered.sort((a, b) => {
      if (sort === "price-asc") return minPrice(a) - minPrice(b);
      if (sort === "price-desc") return minPrice(b) - minPrice(a);
      if (sort === "best") {
        const aScore = (a.featured ? 10 : 0) + (a.category === "perfume" ? 5 : 0);
        const bScore = (b.featured ? 10 : 0) + (b.category === "perfume" ? 5 : 0);
        return bScore - aScore;
      }
      return 0; // "new"
    });
  }, [initialProducts, sort, family, size, concentration, price]);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{isAr ? "المتجر" : "Shop"}</h1>
      <p className="lead" style={{ marginTop: 0 }}>
        {isAr
          ? "العطور هي خط نيفـران الأساسي، مع توسع تدريجي لفئات إضافية."
          : "NIVRAN is perfume-first, with gradual expansion into additional categories."}
      </p>

      <section className="panel" style={{ marginBottom: "1rem", display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <label>
            {isAr ? "الترتيب" : "Sort"}
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="new">{isAr ? "الأحدث" : "New"}</option>
              <option value="best">{isAr ? "الأكثر مبيعًا" : "Best sellers"}</option>
              <option value="price-asc">{isAr ? "السعر: الأقل للأعلى" : "Price low → high"}</option>
              <option value="price-desc">{isAr ? "السعر: الأعلى للأقل" : "Price high → low"}</option>
            </select>
          </label>

          <label>
            {isAr ? "العائلة العطرية" : "Scent family"}
            <select className="input" value={family} onChange={(e) => setFamily(e.target.value as any)}>
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="fresh">{scentFamilyLabels.fresh[locale]}</option>
              <option value="citrus">{scentFamilyLabels.citrus[locale]}</option>
              <option value="musk">{scentFamilyLabels.musk[locale]}</option>
            </select>
          </label>

          <label>
            {isAr ? "الحجم" : "Size"}
            <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="100ml">100ml</option>
              <option value="10ml">10ml</option>
            </select>
          </label>

          <label>
            {isAr ? "التركيز" : "Concentration"}
            <select className="input" value={concentration} onChange={(e) => setConcentration(e.target.value as any)}>
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="EDP">{concentrationLabels.EDP[locale]}</option>
              <option value="EDT">{concentrationLabels.EDT[locale]}</option>
              <option value="CARE">{concentrationLabels.CARE[locale]}</option>
            </select>
          </label>

          <label>
            {isAr ? "نطاق السعر" : "Price range"}
            <select className="input" value={price} onChange={(e) => setPrice(e.target.value)}>
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="0-10">0–10 JOD</option>
              <option value="10-20">10–20 JOD</option>
              <option value="20+">20+ JOD</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid-3">
        {products.map((product) => {
          const v = defaultVariant(product);
          return (
            <article key={product.slug} className="panel">
              <Image
                src={product.images[0]}
                alt={product.name[locale]}
                width={600}
                height={600}
                style={{ width: "100%", height: "auto", borderRadius: 12, marginBottom: 10 }}
              />
              <p className="muted" style={{ marginTop: 0 }}>{categoryLabels[product.category][locale]} · {v.sizeLabel}</p>
              <h3 style={{ margin: "0 0 .35rem" }}>{product.name[locale]}</h3>
              <p className="muted" style={{ marginTop: 0 }}>{product.subtitle[locale]}</p>
              <p><strong>{minPrice(product).toFixed(2)} JOD</strong></p>
              <p className="muted" style={{ marginTop: 0 }}>{product.notes[locale].slice(0, 3).join(" • ")}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn" href={`/${locale}/product/${product.slug}`}>{isAr ? "عرض سريع" : "Quick view"}</a>
                <a className="btn primary" href={`/${locale}/checkout`}>{isAr ? "إضافة سريعة" : "Quick add"}</a>
              </div>
            </article>
          );
        })}
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        {isAr ? "شحن لجميع مناطق الأردن • رسوم ثابتة 3.5 دينار" : "Nationwide Jordan • Flat 3.5 JOD"}
        {" · "}
        <a href={`/${locale}/returns`} style={{ textDecoration: "underline" }}>{isAr ? "سياسة الإرجاع" : "Returns policy"}</a>
      </p>
    </div>
  );
}
