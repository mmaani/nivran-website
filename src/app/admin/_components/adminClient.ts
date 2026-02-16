"use client";

export type AdminLang = "en" | "ar";

const ADMIN_TOKEN_KEY = "nivran_admin_token";
const ADMIN_TOKEN_COOKIE = "admin_token_client";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;

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

export function persistAdminToken(rawToken: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const token = rawToken.trim();
  if (!token) return;
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  document.cookie = `${ADMIN_TOKEN_COOKIE}=${encodeURIComponent(token)}; Max-Age=${TOKEN_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function getStoredAdminToken(): string {
  if (typeof window === "undefined") return "";
  const local = window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  if (local.trim()) return local.trim();
  return getCookieValue(ADMIN_TOKEN_COOKIE).trim();
}

export function clearPersistedAdminToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  if (typeof document !== "undefined") {
    document.cookie = `${ADMIN_TOKEN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}

export function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined);
  const token = getStoredAdminToken();
  if (token && !headers.has("x-admin-token")) {
    headers.set("x-admin-token", token);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
  });
}
