import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function catalogErrorRedirect(req: Request, code: string) {
  return NextResponse.redirect(new URL(`/admin/catalog?error=${encodeURIComponent(code)}`, req.url), 303);
}

function unauthorized(req: Request, status: number, error: string) {
  const accept = req.headers.get("accept") || "";
  const isBrowser = accept.includes("text/html");
  if (isBrowser) {
    const next = "/admin/catalog";
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(next)}`, req.url));
  }
  return NextResponse.json({ ok: false, error }, { status });
}

function normalizeKey(v: unknown) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) return unauthorized(req, auth.status, auth.error);

    await ensureCatalogTablesSafe();
    const form = await req.formData();
    const action = String(form.get("action") || "create");

    if (action === "create") {
      const key = normalizeKey(form.get("key"));
      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const sortOrder = Number(form.get("sort_order") || 0);
      const isActive = String(form.get("is_active") || "") === "on";
      const isPromoted = String(form.get("is_promoted") || "") === "on";

      if (!key || !nameEn || !nameAr) {
        return catalogErrorRedirect(req, "invalid-category");
      }

      await db.query(
        `insert into categories (key, name_en, name_ar, sort_order, is_active, is_promoted)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (key) do update
           set name_en=excluded.name_en,
               name_ar=excluded.name_ar,
               sort_order=excluded.sort_order,
               is_active=excluded.is_active,
               is_promoted=excluded.is_promoted,
               updated_at=now()`,
        [key, nameEn, nameAr, Number.isFinite(sortOrder) ? sortOrder : 0, isActive, isPromoted]
      );
    }

    if (action === "update") {
      const key = normalizeKey(form.get("key"));
      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const sortOrder = Number(form.get("sort_order") || 0);
      const isActive = String(form.get("is_active") || "") === "on";
      const isPromoted = String(form.get("is_promoted") || "") === "on";

      if (key) {
        await db.query(
          `update categories
             set name_en=$2,
                 name_ar=$3,
                 sort_order=$4,
                 is_active=$5,
                 is_promoted=$6,
                 updated_at=now()
           where key=$1`,
          [key, nameEn, nameAr, Number.isFinite(sortOrder) ? sortOrder : 0, isActive, isPromoted]
        );
      }
    }

    if (action === "delete") {
      const key = normalizeKey(form.get("key"));
      if (key) {
        await db.query(`delete from categories where key=$1`, [key]);
        await db.query(`update products set category_key='perfume' where category_key=$1`, [key]);
      }
    }

    return NextResponse.redirect(new URL("/admin/catalog?saved=1", req.url), 303);
  } catch (error: unknown) {
    console.error("[admin/catalog/categories] route error", error);
    return catalogErrorRedirect(req, "category-save-failed");
  }
}
