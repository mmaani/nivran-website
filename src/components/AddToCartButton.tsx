"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clampQty, normalizeCartItems, readLocalCart, writeLocalCart, type CartItem } from "@/lib/cartStore";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBool(obj: JsonRecord, key: string): boolean {
  return obj[key] === true;
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** ✅ Normalize: only positive ints are kept, everything else becomes null */
function normVariantId(v: unknown): number | null {
  const n = toNum(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

/** ✅ Stable key to avoid null/0/undefined mismatches */
function cartKey(slug: string, variantId: number | null): string {
  return `${slug}::${variantId ?? "base"}`;
}

function parseCartItemsUnknown(v: unknown): CartItem[] {
  if (!Array.isArray(v)) return [];

  const out: CartItem[] = [];
  for (const it of v) {
    if (!isRecord(it)) continue;

    const slug = toStr(it.slug).trim();
    if (!slug) continue;

    const qty = Math.max(1, Math.min(99, Math.trunc(toNum(it.qty) || 1)));
    const priceJod = toNum(it.priceJod);

    // tolerate server shapes
    const variantId = normVariantId(it.variantId ?? it.variant_id);
    const variantLabel = typeof it.variantLabel === "string" ? it.variantLabel : null;

    const name = toStr(it.name).trim() || slug;

    out.push({
      slug,
      name,
      priceJod,
      qty,
      variantId,
      variantLabel: variantLabel ?? undefined,
    });
  }

  return normalizeCartItems(out);
}

function sameCart(a: CartItem[], b: CartItem[]): boolean {
  const aa = normalizeCartItems(a);
  const bb = normalizeCartItems(b);
  if (aa.length !== bb.length) return false;

  const mapA = new Map<string, number>();
  for (const it of aa) {
    const k = cartKey(String(it.slug || ""), normVariantId(it.variantId));
    mapA.set(k, Number(it.qty || 0));
  }

  for (const it of bb) {
    const k = cartKey(String(it.slug || ""), normVariantId(it.variantId));
    const q = Number(it.qty || 0);
    if ((mapA.get(k) ?? -1) !== q) return false;
  }

  return true;
}

async function trySyncToAccount(items: CartItem[]) {
  // ✅ send normalized items and explicitly tell server the mode
  const payloadItems = normalizeCartItems(items).map((i) => ({
    slug: i.slug,
    qty: i.qty,
    variantId: normVariantId(i.variantId),
  }));

  const r = await fetch("/api/cart/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "replace", items: payloadItems }),
    cache: "no-store",
  }).catch(() => null);

  if (!r || !r.ok) return;

  const j: unknown = await r.json().catch(() => null);
  if (!isRecord(j)) return;

  if (j.ok === true && getBool(j, "isAuthenticated")) {
    const serverItems = parseCartItemsUnknown(j.items);
    if (!serverItems.length) return;

    // ✅ if local already matches canonical server, don't rewrite (prevents “double apply” feeling)
    const localNow = normalizeCartItems(readLocalCart());
    if (sameCart(localNow, serverItems)) return;

    writeLocalCart(serverItems);
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

  // ✅ normalize once
  const vId = useMemo(() => normVariantId(variantId), [variantId]);

  const addedText = addedLabel || (isAr ? "تمت الإضافة ✓" : "Added ✓");
  const updatedText = updatedLabel || (isAr ? "تم التحديث ✓" : "Updated ✓");

  useEffect(() => {
    const items = normalizeCartItems(readLocalCart());
    const key = cartKey(slug, vId);
    const found = items.find((i) => cartKey(i.slug, normVariantId(i.variantId)) === key);

    if (found?.qty) setQty(Math.min(safeMax, Math.max(safeMin, found.qty)));
    else setQty(safeMin);
  }, [slug, vId, safeMin, safeMax]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

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
    const items = normalizeCartItems(baseItems);
    const key = cartKey(slug, vId);

    const idx = items.findIndex((i) => cartKey(i.slug, normVariantId(i.variantId)) === key);

    const nextItem: CartItem = {
      slug,
      variantId: vId,
      variantLabel,
      name,
      priceJod,
      qty: clampQty(qty, safeMin, safeMax),
    };

    if (idx >= 0) {
      items[idx] = nextItem;
      return { items: normalizeCartItems(items), wasUpdate: true };
    }

    items.push(nextItem);
    return { items: normalizeCartItems(items), wasUpdate: false };
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

    const current = normalizeCartItems(readLocalCart());
    const key = cartKey(slug, vId);
    const idx = current.findIndex((i) => cartKey(i.slug, normVariantId(i.variantId)) === key);

    const selectedQty = clampQty(qty, safeMin, safeMax);

    const items = [...current];
    if (idx >= 0) {
      const prev = items[idx];
      items[idx] = {
        slug,
        variantId: vId,
        variantLabel,
        name,
        priceJod,
        qty: clampQty((prev?.qty || 0) + selectedQty, safeMin, safeMax),
      };
    } else {
      items.push({ slug, variantId: vId, variantLabel, name, priceJod, qty: selectedQty });
    }

    const next = normalizeCartItems(items);
    writeLocalCart(next);
    void trySyncToAccount(next);
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