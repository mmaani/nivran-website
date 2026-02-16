// src/app/api/contact/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureContactTable() {
  await db.query(`
    create table if not exists public.contact_submissions (
      id bigserial primary key,
      name text not null,
      email text not null,
      phone text,
      message text not null,
      locale text not null default 'en',
      created_at timestamptz not null default now()
    );

    alter table public.contact_submissions add column if not exists topic text;
    alter table public.contact_submissions add column if not exists subject text;
    alter table public.contact_submissions add column if not exists order_ref text;

    create index if not exists idx_contact_created_at on public.contact_submissions(created_at desc);
    create index if not exists idx_contact_topic on public.contact_submissions(topic);
  `);
}

export async function POST(req: Request) {
  try {
    await ensureContactTable();

    const body = await req.json().catch(() => ({}));

    // Require: name, email, message, topic
    if (
      !String(body?.name || "").trim() ||
      !String(body?.email || "").trim() ||
      !String(body?.message || "").trim() ||
      !String(body?.topic || "").trim()
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    await db.query(
      `insert into public.contact_submissions
       (name, email, phone, topic, subject, order_ref, message, locale)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        String(body?.name || "").trim(),
        String(body?.email || "").trim(),
        (String(body?.phone || "").trim() || null),
        (String(body?.topic || "").trim() || null),
        (String(body?.subject || "").trim() || null),
        (String(body?.order_ref || "").trim() || null),
        String(body?.message || "").trim(),
        (body?.locale === "ar" ? "ar" : "en"),
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("POST /api/contact failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

