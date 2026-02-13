import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  const isForm = ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
  const body = isForm ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => ({}));

  const email = String((body as any)?.email || "").trim().toLowerCase();
  const locale = String((body as any)?.locale || "en") === "ar" ? "ar" : "en";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  await db.query(
    `insert into newsletter_subscribers (email, locale)
     values ($1,$2)
     on conflict (email) do update set locale=excluded.locale, updated_at=now()`,
    [email, locale]
  );

  if (isForm) {
    return NextResponse.redirect(new URL(`/${locale}?subscribed=1`, req.url));
  }
  return NextResponse.json({ ok: true });
}
