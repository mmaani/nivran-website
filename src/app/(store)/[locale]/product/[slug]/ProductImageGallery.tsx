"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import styles from "./page.module.css";

export default function ProductImageGallery({
  name,
  images,
  fallbackSrc,
}: {
  name: string;
  images: string[];
  fallbackSrc: string;
}) {
  const list = useMemo(() => {
    const arr = Array.isArray(images) ? images.filter(Boolean) : [];
    const base = arr.length ? arr : [fallbackSrc];
    return base.slice(0, 5);
  }, [images, fallbackSrc]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [fallbackSrc, list.length]);

  const safeIdx = Math.min(idx, list.length - 1);
  const current = list[safeIdx];
  const canNav = list.length > 1;

  return (
    <div className={styles.gallery}>
      <div className={styles.mainFrame}>
        <Image
          src={current}
          alt={name}
          className={styles.mainImg}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (el.dataset.fallbackApplied === "1") return;
            el.dataset.fallbackApplied = "1";
            el.src = fallbackSrc;
          }}
          fill
          style={{ objectFit: "contain" }}
        />

        {canNav ? (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnLeft}`}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={safeIdx === 0}
              aria-label="Previous image"
            >
              ‹
            </button>

            <button
              type="button"
              className={`${styles.navBtn} ${styles.navBtnRight}`}
              onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))}
              disabled={safeIdx === list.length - 1}
              aria-label="Next image"
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {canNav ? (
        <div className={styles.thumbs}>
          {list.map((u, i) => (
            <button
              key={`${u}-${i}`}
              type="button"
              className={`${styles.thumbBtn} ${i === safeIdx ? styles.thumbBtnActive : ""}`}
              onClick={() => setIdx(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={i === safeIdx ? "true" : "false"}
            >
              <Image src={u} alt={`${name} ${i + 1}`} className={styles.thumbImg} loading="lazy" fill style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
