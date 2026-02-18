"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";


function shouldBypassOptimizer(src: string): boolean {
  const value = String(src || "").trim();
  return value.startsWith("/api/catalog/product-image/");
}

type Props = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";

  /** If you know dimensions, pass these (best for layout stability). */
  width?: number;
  height?: number;

  /** If width/height are unknown, we auto-use `fill`. Provide `sizes` when possible. */
  sizes?: string;
  unoptimized?: boolean;
};

export default function SafeImg({
  src,
  fallbackSrc,
  alt,
  className,
  style,
  loading = "lazy",
  width,
  height,
  sizes,
  unoptimized,
}: Props) {
  const initial = (src && src.trim()) || (fallbackSrc && fallbackSrc.trim()) || "/placeholder.png";
  const [current, setCurrent] = useState(initial);

  // Reset image when src changes (e.g., new DB image added/removed)
  useEffect(() => {
    const next = (src && src.trim()) || (fallbackSrc && fallbackSrc.trim()) || "/placeholder.png";
    setCurrent(next);
  }, [src, fallbackSrc]);

  const useFill = !(typeof width === "number" && typeof height === "number");
  const bypassOptimizer = typeof unoptimized === "boolean" ? unoptimized : shouldBypassOptimizer(current);

  return (
    <Image
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      {...(useFill
        ? { fill: true as const, sizes: sizes ?? "100vw" }
        : { width, height })}
      unoptimized={bypassOptimizer}
      onError={() => {
        // Prevent infinite loop if fallback also fails
        if (current !== fallbackSrc && fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}
