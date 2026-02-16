import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureInboxTables } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureInboxTables();

    const body = await req.json().catch(() => ({}));

    if (
      !String(body?.name || "").trim() ||
      !String(body?.email || "").trim() ||
      !String(body?.message || "").trim() ||
      !String(body?.topic || "").trim()
    ) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    await db.query(
      `insert into public.contact_submissions
       (name, email, phone, topic, subject, order_ref, message, locale)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        String(body?.name || "").trim(),
        String(body?.email || "").trim(),
        String(body?.phone || "").trim() || null,
        String(body?.topic || "").trim() || null,
        String(body?.subject || "").trim() || null,
        String(body?.order_ref || "").trim() || null,
        String(body?.message || "").trim(),
        body?.locale === "ar" ? "ar" : "en",
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("POST /api/contact failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
