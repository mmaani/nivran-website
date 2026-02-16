import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const input = (await req.json().catch(() => ({}))) as { name?: string; email?: string; phone?: string; message?: string; locale?: string };
  const name = String(input?.name || "").trim();
  const email = String(input?.email || "").trim().toLowerCase();
  const phone = String(input?.phone || "").trim() || null;
  const message = String(input?.message || "").trim();
  const locale = String(input?.locale || "en") === "ar" ? "ar" : "en";

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  await db.query(
    `insert into contact_submissions (name, email, phone, message, locale)
     values ($1,$2,$3,$4,$5)`,
    [name, email, phone, message, locale]
  );

  return NextResponse.json({ ok: true });
}
