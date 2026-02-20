import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import {
  catalogErrorRedirect,
  catalogSavedRedirect,
  catalogUnauthorizedRedirect,
} from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeKey(v: unknown): string {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function keyCandidates(v: unknown): string[] {
  const raw = String(v || "").trim();
  const norm = normalizeKey(raw);
  const out: string[] = [];
  if (raw) out.push(raw);
  if (norm && norm !== raw) out.push(norm);
  return out;
}

export async function POST(req: Request) {
  let form: FormData | null = null;
  try {
    form = await req.formData();
    const auth = requireAdmin(req);
    if (!auth.ok) {
      const accept = req.headers.get("accept") || "";
      if (accept.includes("text/html")) return catalogUnauthorizedRedirect(req, form);
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    await ensureCatalogTablesSafe();
    const action = String(form.get("action") || "create");

    if (action === "create") {
      const key = normalizeKey(form.get("key"));
      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const sortOrderRaw = Number(form.get("sort_order") || 0);
      const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;
      const isActive = String(form.get("is_active") || "") === "on";
      const isPromoted = String(form.get("is_promoted") || "") === "on";

      if (!key || !nameEn || !nameAr) {
        return catalogErrorRedirect(req, form, "invalid-category");
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
        [key, nameEn, nameAr, sortOrder, isActive, isPromoted]
      );

      return catalogSavedRedirect(req, form);
    }

    if (action === "update") {
      const candidates = keyCandidates(form.get("key"));
      if (!candidates.length) return catalogErrorRedirect(req, form, "invalid-category");

      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();
      const sortOrderRaw = Number(form.get("sort_order") || 0);
      const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;
      const isActive = String(form.get("is_active") || "") === "on";
      const isPromoted = String(form.get("is_promoted") || "") === "on";

      let updated = false;
      for (const key of candidates) {
        const r = await db.query(
          `update categories
              set name_en=$2,
                  name_ar=$3,
                  sort_order=$4,
                  is_active=$5,
                  is_promoted=$6,
                  updated_at=now()
            where key=$1`,
          [key, nameEn, nameAr, sortOrder, isActive, isPromoted]
        );
        if ((r as { rowCount?: unknown }).rowCount === 1) {
          updated = true;
          break;
        }
      }

      if (!updated) return catalogErrorRedirect(req, form, "category-not-found");
      return catalogSavedRedirect(req, form);
    }

    if (action === "delete") {
      const candidates = keyCandidates(form.get("key"));
      if (!candidates.length) return catalogErrorRedirect(req, form, "invalid-category");

      let deleted = false;
      for (const key of candidates) {
        await db.query("begin");
        try {
          await db.query(`update products set category_key='perfume' where category_key=$1`, [key]);
          const r = await db.query(`delete from categories where key=$1`, [key]);
          await db.query("commit");
          if ((r as { rowCount?: unknown }).rowCount === 1) {
            deleted = true;
            break;
          }
        } catch (e: unknown) {
          await db.query("rollback");
          throw e;
        }
      }

      if (!deleted) return catalogErrorRedirect(req, form, "category-not-found");
      return catalogSavedRedirect(req, form);
    }

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/categories] route error", error);
    return catalogErrorRedirect(req, form, "category-save-failed");
  }
}
