"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clampQty, mergeCartSum, readLocalCart, writeLocalCart, type CartItem } from "@/lib/cartStore";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBool(obj: JsonRecord, key: string): boolean {
  return obj[key] === true;
}

async function trySyncToAccount(items: CartItem[]) {
  const r = await fetch("/api/cart/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
    cache: "no-store",
  }).catch(() => null);

  if (!r || !r.ok) return;

  const j: unknown = await r.json().catch(() => null);
  if (!isRecord(j)) return;

  if (j.ok === true && getBool(j, "isAuthenticated") && Array.isArray(j.items)) {
    writeLocalCart(mergeCartSum([], j.items as CartItem[]));
  }
}

export default function AddToCartButton({
  locale,
  slug,
  variantId = null,
  variantLabel = "",
  name,
  priceJod,
  label,
  addedLabel,
  updatedLabel,
  className = "btn btn-outline",
  minQty = 1,
  maxQty = 99,
  disabled = false,
  buyNowLabel,
}: {
  locale: string;
  slug: string;
  variantId?: number | null;
  variantLabel?: string;
  name: string;
  priceJod: number;
  label: string;
  addedLabel?: string;
  updatedLabel?: string;
  className?: string;
  minQty?: number;
  maxQty?: number;
  disabled?: boolean;
  buyNowLabel?: string;
}) {
  const isAr = locale === "ar";
  const router = useRouter();
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<"" | "added" | "updated">("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeMin = Math.max(1, Number(minQty || 1));
  const safeMax = Math.max(safeMin, Number(maxQty || 99));

  const addedText = addedLabel || (isAr ? "تمت الإضافة ✓" : "Added ✓");
  const updatedText = updatedLabel || (isAr ? "تم التحديث ✓" : "Updated ✓");

  useEffect(() => {
    const items = readLocalCart();
    const found = items.find((i) => i.slug === slug && (i.variantId || null) === (variantId || null));
    if (found?.qty) setQty(Math.min(safeMax, Math.max(safeMin, found.qty)));
    else setQty(safeMin);
  }, [slug, safeMin, safeMax]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const displayLabel = useMemo(() => {
    if (status === "added") return addedText;
    if (status === "updated") return updatedText;
    return label;
  }, [status, label, addedText, updatedText]);

  function setQtySafe(n: number) {
    setQty(clampQty(n, safeMin, safeMax));
  }

  function flash(next: "added" | "updated") {
    setStatus(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus(""), 1200);
  }

  function upsertCartItem(baseItems: CartItem[]): { items: CartItem[]; wasUpdate: boolean } {
    const items = [...baseItems];
    const idx = items.findIndex((i) => i.slug === slug && (i.variantId || null) === (variantId || null));
    const nextItem: CartItem = { slug, variantId: variantId || null, variantLabel, name, priceJod, qty: clampQty(qty, safeMin, safeMax) };

    if (idx >= 0) {
      items[idx] = nextItem;
      return { items, wasUpdate: true };
    }
    items.push(nextItem);
    return { items, wasUpdate: false };
  }

  async function onSetCart() {
    if (disabled) return;

    const { items, wasUpdate } = upsertCartItem(readLocalCart());
    writeLocalCart(items);
    flash(wasUpdate ? "updated" : "added");
    void trySyncToAccount(items);
  }

  async function onBuyNow() {
    if (disabled) return;

    const current = readLocalCart();
    const idx = current.findIndex((i) => i.slug === slug && (i.variantId || null) === (variantId || null));
    const selectedQty = clampQty(qty, safeMin, safeMax);

    const items = [...current];
    if (idx >= 0) {
      const prev = items[idx];
      items[idx] = {
        slug,
        variantId: variantId || null,
        variantLabel,
        name,
        priceJod,
        qty: clampQty((prev?.qty || 0) + selectedQty, safeMin, safeMax),
      };
    } else {
      items.push({ slug, variantId: variantId || null, variantLabel, name, priceJod, qty: selectedQty });
    }

    writeLocalCart(items);
    void trySyncToAccount(items);
    router.push(`/${locale}/checkout`);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setQtySafe(qty - 1)}
          disabled={disabled || qty <= safeMin}
          aria-label={isAr ? "إنقاص الكمية" : "Decrease quantity"}
        >
          −
        </button>

        <input
          value={String(qty)}
          onChange={(e) => setQtySafe(Number(e.target.value))}
          inputMode="numeric"
          type="number"
          min={safeMin}
          max={safeMax}
          disabled={disabled}
          aria-label={isAr ? "الكمية" : "Quantity"}
          style={{ width: 64, height: 40, borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 10px", outline: "none" }}
        />

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setQtySafe(qty + 1)}
          disabled={disabled || qty >= safeMax}
          aria-label={isAr ? "زيادة الكمية" : "Increase quantity"}
        >
          +
        </button>
      </div>

      <button type="button" className={className} onClick={onSetCart} disabled={disabled} aria-live="polite">
        {displayLabel}
      </button>

      {buyNowLabel ? (
        <button type="button" className={className.replace("btn-outline", "").trim() || "btn"} onClick={onBuyNow} disabled={disabled}>
          {buyNowLabel}
        </button>
      ) : null}
    </div>
  );
}
