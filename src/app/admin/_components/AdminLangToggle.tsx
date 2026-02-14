// src/app/admin/_components/AdminLangToggle.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLangToggle({ lang }: { lang: "en" | "ar" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const next = lang === "en" ? "ar" : "en";
      await fetch("/api/admin/lang", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="admin-btn admin-btn-ghost"
      aria-label="Toggle language"
      disabled={busy}
    >
      {lang === "en" ? "عربي" : "EN"}
    </button>
  );
}
