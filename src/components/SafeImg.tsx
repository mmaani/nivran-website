"use client";

import React, { useEffect, useState } from "react";

type Props = {
  src: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  loading?: "lazy" | "eager";
};

export default function SafeImg({
  src,
  fallbackSrc,
  alt,
  className,
  style,
  loading = "lazy",
}: Props) {
  const [current, setCurrent] = useState(src);

  // Reset image when src changes (e.g., new DB image added/removed)
  useEffect(() => {
    setCurrent(src);
  }, [src]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={() => {
        // Prevent infinite loop if fallback also fails
        if (current !== fallbackSrc) setCurrent(fallbackSrc);
      }}
    />
  );
}
