"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const KEY = "nivran_cart_v1";

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        slug: String(x?.slug || ""),
        name: String(x?.name || ""),
        priceJod: Number(x?.priceJod || 0),
        qty: Math.max(1, Math.min(99, Number(x?.qty || 1))),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("nivran_cart_updated"));
}

async function trySyncToAccount(items: CartItem[]) {
  // If not logged in, endpoint returns 401 — we ignore.
  const r = await fetch("/api/cart/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
    cache: "no-store",
  }).catch(() => null);

  if (!r || !r.ok) return;

  const j = await r.json().catch(() => null);
  if (j?.ok && Array.isArray(j.items)) {
    writeCart(j.items);
  }
}

export default function AddToCartButton({
  locale,
  slug,
  name,
  priceJod,
  label,
  addedLabel,
  updatedLabel,
  className = "btn btn-outline",
  minQty = 1,
  maxQty = 99,
  disabled = false,
}: {
  locale: string;
  slug: string;
  name: string;
  priceJod: number;
  label: string;
  addedLabel?: string;
  updatedLabel?: string;
  className?: string;
  minQty?: number;
  maxQty?: number;
  disabled?: boolean;
}) {
  const isAr = locale === "ar";
  const [qty, setQty] = useState<number>(1);
  const [status, setStatus] = useState<"" | "added" | "updated">("");
  const timerRef = useRef<any>(null);

  const safeMin = Math.max(1, Number(minQty || 1));
  const safeMax = Math.max(safeMin, Number(maxQty || 99));

  const addedText = addedLabel || (isAr ? "تمت الإضافة ✓" : "Added ✓");
  const updatedText = updatedLabel || (isAr ? "تم التحديث ✓" : "Updated ✓");

  useEffect(() => {
    try {
      const items = readCart();
      const found = items.find((i) => i.slug === slug);
      if (found?.qty) setQty(Math.min(safeMax, Math.max(safeMin, found.qty)));
      else setQty(safeMin);
    } catch {
      setQty(safeMin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const displayLabel = useMemo(() => {
    if (status === "added") return addedText;
    if (status === "updated") return updatedText;
    return label;
  }, [status, label, addedText, updatedText]);

  function clamp(n: number) {
    if (!Number.isFinite(n)) return safeMin;
    return Math.min(safeMax, Math.max(safeMin, Math.floor(n)));
  }

  function setQtySafe(n: number) {
    setQty(clamp(n));
  }

  function flash(next: "added" | "updated") {
    setStatus(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus(""), 1200);
  }

  async function onSetCart() {
    if (disabled) return;

    const items = readCart();
    const idx = items.findIndex((i) => i.slug === slug);

    const nextItem: CartItem = { slug, name, priceJod, qty: clamp(qty) };

    if (idx >= 0) {
      items[idx] = nextItem;
      writeCart(items);
      flash("updated");
    } else {
      items.push(nextItem);
      writeCart(items);
      flash("added");
    }

    // ✅ Persist to account if logged in
    void trySyncToAccount(items);
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
          style={{
            width: 64,
            height: 40,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            padding: "0 10px",
            outline: "none",
          }}
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
    </div>
  );
}
