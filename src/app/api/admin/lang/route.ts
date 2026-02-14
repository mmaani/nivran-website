// src/app/api/admin/lang/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let lang = "en";
  let next = "";

  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as any;
    lang = String(body?.lang || "en");
    next = String(body?.next || "");
  } else {
    const form = await req.formData();
    lang = String(form.get("lang") || "en");
    next = String(form.get("next") || "");
  }

  lang = lang === "ar" ? "ar" : "en";

  // If request came from a normal HTML form (not fetch), we can redirect back.
  const wantsRedirect = !ct.includes("application/json");
  const referer = req.headers.get("referer") || "";
  const fallback = "/admin/orders";

  const res = wantsRedirect
    ? NextResponse.redirect(new URL(next || referer || fallback, req.url))
    : NextResponse.json({ ok: true, lang });

  // Only for admin area
  res.cookies.set("admin_lang", lang, {
    path: "/admin",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}
