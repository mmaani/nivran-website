"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type CartItem = {
  slug: string;
  name: string;
  priceJod: number;
  qty: number;
};

const KEY = "nivran_cart_v1";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function clampQty(n: unknown, min: number, max: number): number {
  const x = Math.floor(toNum(n) || min);
  return Math.min(max, Math.max(min, x));
}

function parseCartItems(v: unknown): CartItem[] {
  if (!Array.isArray(v)) return [];
  const out: CartItem[] = [];

  for (const it of v) {
    if (!isRecord(it)) continue;

    const slug = toStr(it.slug).trim();
    if (!slug) continue;

    out.push({
      slug,
      name: toStr(it.name).trim(),
      priceJod: toNum(it.priceJod),
      qty: clampQty(it.qty, 1, 99),
    });
  }

  return out;
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return parseCartItems(parsed);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("nivran_cart_updated"));
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

  if (j.ok === true && getBool(j, "isAuthenticated")) {
    if (Array.isArray(j.items)) writeCart(parseCartItems(j.items));
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeMin = Math.max(1, Number(minQty || 1));
  const safeMax = Math.max(safeMin, Number(maxQty || 99));

  const addedText = addedLabel || (isAr ? "تمت الإضافة ✓" : "Added ✓");
  const updatedText = updatedLabel || (isAr ? "تم التحديث ✓" : "Updated ✓");

  useEffect(() => {
    const items = readCart();
    const found = items.find((i) => i.slug === slug);
    if (found?.qty) setQty(Math.min(safeMax, Math.max(safeMin, found.qty)));
    else setQty(safeMin);
  }, [slug, safeMin, safeMax]);

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
