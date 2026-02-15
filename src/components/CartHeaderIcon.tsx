"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const KEY = "nivran_cart_v1";

function readCount(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((sum: number, x: any) => sum + Math.max(0, Number(x?.qty || 0)), 0);
  } catch {
    return 0;
  }
}

function inferLocaleFromPath(pathname: string): "en" | "ar" {
  const seg = String(pathname || "/").split("/").filter(Boolean)[0];
  return seg === "ar" ? "ar" : "en";
}

export default function CartHeaderIcon({ locale }: { locale?: "en" | "ar" }) {
  const pathname = usePathname();
  const loc = locale || inferLocaleFromPath(pathname);
  const isAr = loc === "ar";

  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    setCount(readCount());

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === KEY) setCount(readCount());
    };
    const onCustom = () => setCount(readCount());

    window.addEventListener("storage", onStorage);
    window.addEventListener("nivran_cart_updated", onCustom as any);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nivran_cart_updated", onCustom as any);
    };
  }, []);

  return (
    <a
      href={`/${loc}/cart`}
      aria-label={isAr ? "السلة" : "Cart"}
      title={isAr ? "السلة" : "Cart"}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: "#fff",
        textDecoration: "none",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 6h14l-1.5 8h-11L6.5 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6.5 6 6 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>

      <span
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          minWidth: 18,
          height: 18,
          padding: "0 5px",
          borderRadius: 999,
          background: "#111827",
          color: "#fff",
          fontSize: 12,
          lineHeight: "18px",
          textAlign: "center",
        }}
      >
        {count}
      </span>
    </a>
  );
}
