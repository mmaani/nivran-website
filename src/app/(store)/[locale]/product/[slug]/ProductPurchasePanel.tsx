"use client";

import { useMemo, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";

type Variant = {
  id: number;
  label: string;
  priceJod: number;
  compareAtPriceJod: number | null;
  isDefault: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function ProductPurchasePanel({
  locale,
  slug,
  name,
  variants,
  promoType,
  promoValue,
  outOfStock,
}: {
  locale: "en" | "ar";
  slug: string;
  name: string;
  variants: Variant[];
  promoType: "PERCENT" | "FIXED" | null;
  promoValue: number;
  outOfStock: boolean;
}) {
  const isAr = locale === "ar";
  const selectedDefault = variants.find((v) => v.isDefault) || variants[0];
  const [selectedId, setSelectedId] = useState<number>(selectedDefault?.id || 0);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) || selectedDefault,
    [selectedDefault, selectedId, variants]
  );

  if (!selected) return null;

  const basePrice = selected.priceJod;
  const compareAt = selected.compareAtPriceJod;
  const discountedPrice =
    promoType === "PERCENT"
      ? round2(Math.max(0, basePrice - basePrice * (promoValue / 100)))
      : promoType === "FIXED"
        ? round2(Math.max(0, basePrice - promoValue))
        : basePrice;
  const hasPromo = promoType != null && discountedPrice < basePrice;

  return (
    <>
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {variants.map((variant) => {
          const active = variant.id === selected.id;
          return (
            <button
              key={variant.id}
              type="button"
              className="btn btn-outline"
              onClick={() => setSelectedId(variant.id)}
              style={{
                borderColor: active ? "#b08d57" : undefined,
                color: active ? "#7a5a2a" : undefined,
                background: active ? "#fffaf0" : undefined,
              }}
            >
              {variant.label}
            </button>
          );
        })}
      </div>

      <p style={{ marginTop: 10 }}>
        {hasPromo ? (
          <>
            <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 10 }}>
              {basePrice.toFixed(2)} JOD
            </span>
            <strong>{discountedPrice.toFixed(2)} JOD</strong>
          </>
        ) : compareAt && compareAt > basePrice ? (
          <>
            <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 10 }}>
              {compareAt.toFixed(2)} JOD
            </span>
            <strong>{basePrice.toFixed(2)} JOD</strong>
          </>
        ) : (
          <strong>{basePrice.toFixed(2)} JOD</strong>
        )}
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        <AddToCartButton
          locale={locale}
          slug={slug}
          variantId={selected.id}
          variantLabel={selected.label}
          name={name}
          priceJod={basePrice}
          label={outOfStock ? (isAr ? "غير متوفر" : "Out of stock") : (isAr ? "أضف إلى السلة" : "Add to cart")}
          addedLabel={isAr ? "تمت الإضافة ✓" : "Added ✓"}
          updatedLabel={isAr ? "تم التحديث ✓" : "Updated ✓"}
          className={"btn btn-outline" + (outOfStock ? " btn-disabled" : "")}
          disabled={outOfStock}
          minQty={1}
          maxQty={99}
          buyNowLabel={isAr ? "شراء الآن" : "Buy now"}
        />

        <a className="btn btn-outline" href={`/${locale}/product`}>
          {isAr ? "العودة للمتجر" : "Back to shop"}
        </a>
      </div>
    </>
  );
}
