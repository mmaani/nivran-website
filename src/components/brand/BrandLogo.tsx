"use client";

import { useState } from "react";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  height?: number;
  className?: string;
};

export default function BrandLogo({ href = "/", height = 28, className }: BrandLogoProps) {
  const [active, setActive] = useState(false);
  const src = active ? "/brand/logo-nivran-gold-hover.svg" : "/brand/logo-nivran-gold.svg";

  return (
    <Link
      href={href}
      aria-label="NIVRAN Home"
      className={className}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      <img
        src={src}
        alt="NIVRAN"
        height={height}
        style={{ height, width: "auto", display: "block" }}
        draggable={false}
      />
    </Link>
  );
}
