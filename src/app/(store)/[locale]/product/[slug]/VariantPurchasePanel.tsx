"use client";

import { useMemo, useState } from "react";
import AddToCartButton from "@/components/AddToCartButton";

type Variant = {
  id: number;
  label: string;
  priceJod: number;
  compareAtPriceJod: number | null;
};

export default function VariantPurchasePanel({ locale, slug, name, variants, disabled }: { locale: string; slug: string; name: string; variants: Variant[]; disabled: boolean }) {
  const [selectedId, setSelectedId] = useState<number>(variants[0]?.id || 0);
  const selected = useMemo(() => variants.find((v) => v.id === selectedId) || variants[0], [variants, selectedId]);
  if (!selected) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {variants.map((v) => (
          <button key={v.id} type="button" className={"btn " + (v.id === selected.id ? "" : "btn-outline")} onClick={() => setSelectedId(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 0 }}>
        {selected.compareAtPriceJod && selected.compareAtPriceJod > selected.priceJod ? (
          <>
            <span style={{ textDecoration: "line-through", opacity: 0.7, marginInlineEnd: 8 }}>{selected.compareAtPriceJod.toFixed(2)} JOD</span>
            <strong>{selected.priceJod.toFixed(2)} JOD</strong>
          </>
        ) : (
          <strong>{selected.priceJod.toFixed(2)} JOD</strong>
        )}
      </p>
      <AddToCartButton
        locale={locale}
        slug={slug}
        name={name}
        variantId={selected.id}
        variantLabel={selected.label}
        priceJod={selected.priceJod}
        label={disabled ? (locale === "ar" ? "غير متوفر" : "Out of stock") : (locale === "ar" ? "أضف إلى السلة" : "Add to cart")}
        addedLabel={locale === "ar" ? "تمت الإضافة ✓" : "Added ✓"}
        updatedLabel={locale === "ar" ? "تم التحديث ✓" : "Updated ✓"}
        className={"btn btn-outline" + (disabled ? " btn-disabled" : "")}
        disabled={disabled}
        minQty={1}
        maxQty={99}
        buyNowLabel={locale === "ar" ? "شراء الآن" : "Buy now"}
      />
    </div>
  );
}
