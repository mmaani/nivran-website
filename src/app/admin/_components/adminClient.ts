"use client";

export type AdminLang = "en" | "ar";

export function getCookieValue(name: string): string {
  if (typeof document === "undefined") return "";
  const regex = new RegExp(`(?:^|; )${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`);
  const match = document.cookie.match(regex);
  return match ? decodeURIComponent(match[1]) : "";
}

export function readAdminLangCookie(): AdminLang {
  const value = getCookieValue("admin_lang");
  return value === "ar" ? "ar" : "en";
}


export function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
