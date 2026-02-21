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

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function keyCandidates(value: unknown): string[] {
  const raw = String(value ?? "").trim();
  if (!raw) return [];

  const base = raw.toLowerCase();
  const hyphen = base.replace(/_/g, "-");
  const underscore = base.replace(/-/g, "_");
  const norm = normalizeKey(base);

  const out = new Set<string>();
  for (const k of [base, hyphen, underscore, norm]) {
    const kk = String(k ?? "").trim();
    if (!kk) continue;
    out.add(kk);
    const nk = normalizeKey(kk);
    if (nk) out.add(nk);
  }

  return Array.from(out);
}

/**
 * Returns SQL + mutable args arrays (unknown[]) so db.query() accepts them.
 */
function mergeCategoryKeySql(fromKey: string, toKey: string): {
  updateProducts: [string, unknown[]];
  updatePromotions: [string, unknown[]];
} {
  return {
    updateProducts: [
      `update products set category_key=$2 where category_key=$1`,
      [fromKey, toKey],
    ],
    updatePromotions: [
      `update promotions
          set category_keys = (
            select array_agg(case when x=$1 then $2 else x end)
            from unnest(category_keys) x
          )
        where category_keys is not null
          and $1 = any(category_keys)`,
      [fromKey, toKey],
    ],
  };
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

    // ------------------------------------------------------------
    // CREATE
    // ------------------------------------------------------------
    if (action === "create") {
      const rawKey = String(form.get("key") || "");
      const key = normalizeKey(rawKey);
      const candidates = keyCandidates(rawKey);

      const nameEn = String(form.get("name_en") || "").trim();
      const nameAr = String(form.get("name_ar") || "").trim();

      const sortOrderRaw = Number(form.get("sort_order") || 0);
      const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

      const isActive = String(form.get("is_active") || "") === "on";
      const isPromoted = String(form.get("is_promoted") || "") === "on";

      if (!key || !nameEn || !nameAr) {
        return catalogErrorRedirect(req, form, "invalid-category");
      }

      // If legacy keys exist (e.g. hand_gel / air_freshener), unify them to normalized hyphen key.
      if (candidates.length) {
        const existing = await db.query<{ key: string }>(
          `select key from categories where key = any($1::text[])`,
          [candidates]
        );

        const existingKeys = (existing.rows || [])
          .map((r) => String(r.key || "").trim())
          .filter((k) => !!k && k !== key);

        if (existingKeys.length) {
          await db.query("begin");
          try {
            // Ensure the normalized key exists: if not, rename the first legacy key to the normalized key.
            const target = await db.query<{ ok: number }>(
              `select 1 as ok from categories where key=$1 limit 1`,
              [key]
            );
            const hasTarget = (target.rowCount ?? 0) > 0;

            const remaining = existingKeys.slice();
            if (!hasTarget) {
              const first = remaining.shift();
              if (first) {
                await db.query(`update categories set key=$2 where key=$1`, [first, key]);
              }
            }

            // Merge all remaining legacy keys into normalized key.
            for (const oldKey of remaining) {
              const merge = mergeCategoryKeySql(oldKey, key);

              await db.query(merge.updateProducts[0], merge.updateProducts[1]);
              await db.query(merge.updatePromotions[0], merge.updatePromotions[1]);

              await db.query(`delete from categories where key=$1`, [oldKey]);
            }

            await db.query("commit");
          } catch (e: unknown) {
            await db.query("rollback");
            throw e;
          }
        }
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

    // ------------------------------------------------------------
    // UPDATE
    // ------------------------------------------------------------
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
        if ((r.rowCount ?? 0) === 1) {
          updated = true;
          break;
        }
      }

      if (!updated) return catalogErrorRedirect(req, form, "category-not-found");
      return catalogSavedRedirect(req, form);
    }

    // ------------------------------------------------------------
    // DELETE
    // ------------------------------------------------------------
    if (action === "delete") {
      const candidates = keyCandidates(form.get("key"));
      if (!candidates.length) return catalogErrorRedirect(req, form, "invalid-category");

      let deleted = false;

      for (const key of candidates) {
        await db.query("begin");
        try {
          // Move products off the category being deleted (fallback to 'perfume')
          await db.query(`update products set category_key='perfume' where category_key=$1`, [key]);

          // Remove category key from promotions arrays
          await db.query(
            `update promotions
                set category_keys = array_remove(category_keys, $1::text)
              where category_keys is not null
                and category_keys @> array[$1::text]::text[]`,
            [key]
          );

          const r = await db.query(`delete from categories where key=$1`, [key]);

          await db.query("commit");

          if ((r.rowCount ?? 0) === 1) {
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

    // Unknown action: treat as saved
    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/categories] route error", error);
    return catalogErrorRedirect(req, form, "category-save-failed");
  }
}
