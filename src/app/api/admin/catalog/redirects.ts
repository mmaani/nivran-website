import { NextResponse } from "next/server";

function normalizeReturnTo(value: FormDataEntryValue | null): string {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/admin/catalog")) return "/admin/catalog";
  return raw;
}

export function catalogReturnPath(form: FormData, extra?: Record<string, string | number | boolean>): string {
  const base = normalizeReturnTo(form.get("return_to"));
  const url = new URL(base, "https://local.nivran");
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

export function catalogErrorRedirect(req: Request, form: FormData | null, code: string) {
  const path = form ? catalogReturnPath(form, { error: code }) : `/admin/catalog?error=${encodeURIComponent(code)}`;
  return NextResponse.redirect(new URL(path, req.url), 303);
}

export function catalogSavedRedirect(req: Request, form: FormData | null, extra?: Record<string, string | number | boolean>) {
  const path = form ? catalogReturnPath(form, { saved: 1, ...(extra || {}) }) : "/admin/catalog?saved=1";
  return NextResponse.redirect(new URL(path, req.url), 303);
}

export function catalogUnauthorizedRedirect(req: Request, form: FormData | null) {
  const next = form ? catalogReturnPath(form) : "/admin/catalog";
  return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(next)}`, req.url), 303);
}
