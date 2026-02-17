"use client";

import { useMemo, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";

type Variant = { id: number; label: string; priceJod: number; compareAtPriceJod: number | null };

export default function ProductPurchasePanel({
  locale,
  name,
  slug,
  variants,
  defaultVariantId,
  outOfStock,
}: {
  locale: "en" | "ar";
  name: string;
  slug: string;
  variants: Variant[];
  defaultVariantId: number | null;
  outOfStock: boolean;
}) {
  const isAr = locale === "ar";
  const [selectedId, setSelectedId] = useState<number>(defaultVariantId || variants[0]?.id || 0);
  const current = useMemo(() => variants.find((v) => v.id === selectedId) || variants[0], [variants, selectedId]);
  if (!current) return null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {variants.map((variant) => (
          <button key={variant.id} className="btn btn-outline" type="button" onClick={() => setSelectedId(variant.id)} style={{ borderColor: variant.id === current.id ? "#b08a42" : undefined }}>
            {variant.label}
          </button>
        ))}
      </div>

      <p style={{ margin: 0 }}>
        {current.compareAtPriceJod && current.compareAtPriceJod > current.priceJod ? (
          <>
            <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 8 }}>{current.compareAtPriceJod.toFixed(2)} JOD</span>
            <strong>{current.priceJod.toFixed(2)} JOD</strong>
          </>
        ) : (
          <strong>{current.priceJod.toFixed(2)} JOD</strong>
        )}
      </p>

      <AddToCartButton
        locale={locale}
        slug={slug}
        variantId={current.id}
        variantLabel={current.label}
        name={name}
        priceJod={current.priceJod}
        label={outOfStock ? (isAr ? "غير متوفر" : "Out of stock") : (isAr ? "أضف إلى السلة" : "Add to cart")}
        addedLabel={isAr ? "تمت الإضافة ✓" : "Added ✓"}
        updatedLabel={isAr ? "تم التحديث ✓" : "Updated ✓"}
        className={"btn btn-outline" + (outOfStock ? " btn-disabled" : "")}
        disabled={outOfStock}
        buyNowLabel={isAr ? "شراء الآن" : "Buy now"}
      />
    </div>
  );
}
