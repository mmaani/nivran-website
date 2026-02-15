"use client";

import React from "react";
import { useRouter } from "next/navigation";

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
        qty: Math.max(1, Number(x?.qty || 1)),
      }))
      .filter((x: CartItem) => !!x.slug);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export default function AddToCartButton({
  locale,
  slug,
  name,
  priceJod,
  label,
  className = "btn btn-outline",
}: {
  locale: string;
  slug: string;
  name: string;
  priceJod: number;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  const href = `/${locale}/cart`;

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();

    const items = readCart();
    const idx = items.findIndex((i) => i.slug === slug);

    if (idx >= 0) {
      items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
    } else {
      items.push({ slug, name, priceJod, qty: 1 });
    }

    writeCart(items);
    router.push(`/${locale}/cart?added=1`);
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {label}
    </a>
  );
}
