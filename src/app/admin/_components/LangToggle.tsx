// src/app/admin/_components/LangToggle.tsx
"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function LangToggle({ initialLang }: { initialLang: "en" | "ar" }) {
  const [isAr, setIsAr] = useState(initialLang === "ar");
  const pathname = usePathname();
  const router = useRouter();

  async function onToggle(nextAr: boolean) {
    setIsAr(nextAr);
    try {
      await fetch("/api/admin/lang", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lang: nextAr ? "ar" : "en", next: pathname }),
      });
    } finally {
      // Refresh server components so layout dir/lang updates immediately
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => onToggle(!isAr)}
      aria-pressed={isAr}
      title={isAr ? "Switch to English" : "التحويل إلى العربية"}
    >
      <span className="lang-toggle-track" aria-hidden="true">
        <span className="lang-toggle-thumb" />
      </span>
      <span className="lang-toggle-label">{isAr ? "AR" : "EN"}</span>
    </button>
  );
}
