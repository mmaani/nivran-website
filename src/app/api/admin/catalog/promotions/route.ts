import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: Request, status: number, error: string) {
  const accept = req.headers.get("accept") || "";
  const isBrowser = accept.includes("text/html");
  if (isBrowser) {
    const next = "/admin/catalog";
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(next)}`, req.url));
  }
  return NextResponse.json({ ok: false, error }, { status });
}

function readCategoryKeys(form: FormData): string[] | null {
  const raw = form.getAll("category_keys").map((v) => String(v || "").trim()).filter(Boolean);
  if (!raw.length || raw.includes("__ALL__")) return null;
  return Array.from(new Set(raw));
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return unauthorized(req, auth.status, auth.error);

  await ensureCatalogTables();
  const form = await req.formData();
  const action = String(form.get("action") || "create");

  if (action === "create") {
    const promoKind = String(form.get("promo_kind") || "CODE").toUpperCase() === "AUTO" ? "AUTO" : "CODE";
    const codeRaw = String(form.get("code") || "").trim().toUpperCase();
    const code = promoKind === "CODE" ? codeRaw : null;
    const titleEn = String(form.get("title_en") || "").trim();
    const titleAr = String(form.get("title_ar") || "").trim();
    const discountType = String(form.get("discount_type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
    const discountValue = Number(form.get("discount_value") || 0);
    const startsAt = String(form.get("starts_at") || "").trim() || null;
    const endsAt = String(form.get("ends_at") || "").trim() || null;

    const usageLimitRaw = String(form.get("usage_limit") || "").trim();
    const usageLimit = usageLimitRaw ? Number(usageLimitRaw) : null;

    const minOrderRaw = String(form.get("min_order_jod") || "").trim();
    const minOrderJod = minOrderRaw ? Number(minOrderRaw) : null;

    const isActive = String(form.get("is_active") || "") === "on";
    const categoryKeys = readCategoryKeys(form);

    if (!titleEn || !titleAr || !Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.redirect(new URL("/admin/catalog?error=invalid-promo", req.url));
    }

    if (promoKind === "CODE" && !code) {
      return NextResponse.redirect(new URL("/admin/catalog?error=missing-code", req.url));
    }

    if (minOrderRaw && (!Number.isFinite(minOrderJod) || Number(minOrderJod) < 0)) {
      return NextResponse.redirect(new URL("/admin/catalog?error=invalid-min-order", req.url));
    }

    await db.query(
      `insert into promotions
        (promo_kind, code, title_en, title_ar, discount_type, discount_value, starts_at, ends_at, usage_limit, min_order_jod, is_active, category_keys)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (code) where promo_kind='CODE'
       do update
         set promo_kind=excluded.promo_kind,
             title_en=excluded.title_en,
             title_ar=excluded.title_ar,
             discount_type=excluded.discount_type,
             discount_value=excluded.discount_value,
             starts_at=excluded.starts_at,
             ends_at=excluded.ends_at,
             usage_limit=excluded.usage_limit,
             min_order_jod=excluded.min_order_jod,
             is_active=excluded.is_active,
             category_keys=excluded.category_keys,
             updated_at=now()`,
      [promoKind, code, titleEn, titleAr, discountType, discountValue, startsAt, endsAt, usageLimit, minOrderJod, isActive, categoryKeys]
    );
  }

  if (action === "toggle") {
    const id = Number(form.get("id") || 0);
    const isActive = String(form.get("is_active") || "") === "on";
    if (id > 0) {
      await db.query(`update promotions set is_active=$2, updated_at=now() where id=$1`, [id, isActive]);
    }
  }

  if (action === "delete") {
    const id = Number(form.get("id") || 0);
    if (id > 0) {
      await db.query(`delete from promotions where id=$1`, [id]);
    }
  }

  return NextResponse.redirect(new URL("/admin/catalog?saved=1", req.url));
}
