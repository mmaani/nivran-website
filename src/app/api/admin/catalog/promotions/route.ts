import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureCatalogTables();
  const form = await req.formData();
  const action = String(form.get("action") || "create");

  if (action === "create") {
    const code = String(form.get("code") || "").trim().toUpperCase();
    const titleEn = String(form.get("title_en") || "").trim();
    const titleAr = String(form.get("title_ar") || "").trim();
    const discountType = String(form.get("discount_type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
    const discountValue = Number(form.get("discount_value") || 0);
    const startsAt = String(form.get("starts_at") || "").trim() || null;
    const endsAt = String(form.get("ends_at") || "").trim() || null;
    const usageLimitRaw = String(form.get("usage_limit") || "").trim();
    const usageLimit = usageLimitRaw ? Number(usageLimitRaw) : null;
    const isActive = String(form.get("is_active") || "") === "on";

    if (!code || !titleEn || !titleAr || !Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.redirect(new URL("/admin/catalog?error=invalid-promo", req.url));
    }

    await db.query(
      `insert into promotions (code, title_en, title_ar, discount_type, discount_value, starts_at, ends_at, usage_limit, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (code) do update
         set title_en=excluded.title_en,
             title_ar=excluded.title_ar,
             discount_type=excluded.discount_type,
             discount_value=excluded.discount_value,
             starts_at=excluded.starts_at,
             ends_at=excluded.ends_at,
             usage_limit=excluded.usage_limit,
             is_active=excluded.is_active,
             updated_at=now()`,
      [code, titleEn, titleAr, discountType, discountValue, startsAt, endsAt, usageLimit, isActive]
    );
  }

  if (action === "toggle") {
    const id = Number(form.get("id") || 0);
    const isActive = String(form.get("is_active") || "") === "on";
    if (id > 0) {
      await db.query(`update promotions set is_active=$2, updated_at=now() where id=$1`, [id, isActive]);
    }
  }

  return NextResponse.redirect(new URL("/admin/catalog?saved=1", req.url));
}
