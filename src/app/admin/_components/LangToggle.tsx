"use client";

import { useEffect, useState } from "react";

const KEY = "nivran_admin_lang";
type Lang = "en" | "ar";

function applyLang(lang: Lang) {
  const root = document.documentElement;

  root.classList.toggle("admin-lang-ar", lang === "ar");
  root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  root.setAttribute("lang", lang === "ar" ? "ar" : "en");
}

export default function LangToggle() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = (window.localStorage.getItem(KEY) as Lang) || "en";
    const initial: Lang = saved === "ar" ? "ar" : "en";
    setLang(initial);
    applyLang(initial);
  }, []);

  function toggle() {
    const next: Lang = lang === "en" ? "ar" : "en";
    setLang(next);
    window.localStorage.setItem(KEY, next);
    applyLang(next);
  }

  return (
    <button className="btn btn-secondary" type="button" onClick={toggle} title="EN/AR">
      <span className="t-en">{lang === "en" ? "AR" : "EN"}</span>
      <span className="t-ar">{lang === "en" ? "عربي" : "English"}</span>
    </button>
  );
}
