"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HeaderLogoProps = {
  href: string;
  heightDesktop?: number;
  heightMobile?: number;
  className?: string;
};

export default function HeaderLogo({ href, heightDesktop = 56, heightMobile = 28, className }: HeaderLogoProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      if (!desktop) setActive(false);
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const desktopSrc = active ? "/brand/header-desktop-hover.svg" : "/brand/header-desktop.svg";
  const widthDesktop = useMemo(() => Math.round(heightDesktop * 5.2), [heightDesktop]);
  const widthMobile = useMemo(() => Math.round(heightMobile * 5.2), [heightMobile]);

  return (
    <Link
      href={href}
      className={className}
      aria-label="NIVRAN"
      onMouseEnter={() => {
        if (isDesktop) setActive(true);
      }}
      onMouseLeave={() => setActive(false)}
      onFocus={() => {
        if (isDesktop) setActive(true);
      }}
      onBlur={() => setActive(false)}
      style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}
    >
      <picture style={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}>
        <source media="(min-width: 768px)" srcSet={desktopSrc} />
        <img
          src="/brand/header-mobile.svg"
          alt="NIVRAN"
          width={isDesktop ? widthDesktop : widthMobile}
          height={isDesktop ? heightDesktop : heightMobile}
          style={{
            display: "block",
            width: "auto",
            height: isDesktop ? `${heightDesktop}px` : `${heightMobile}px`,
            maxHeight: isDesktop ? `${heightDesktop}px` : `${heightMobile}px`,
            transition: "opacity 180ms ease",
            opacity: active ? 0.96 : 1,
          }}
          loading="eager"
          decoding="async"
        />
      </picture>
    </Link>
  );
}
