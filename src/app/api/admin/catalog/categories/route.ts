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

type CategoryRow = {
  key: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  is_active: boolean;
  is_promoted: boolean;
};

type PromoKeysRow = {
  id: number;
  category_keys: string[] | null;
};

function pickFirstNonEmpty(values: string[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function uniqPreserveOrder(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
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

    // ============================================================
    // ONE-CLICK NORMALIZE ALL
    // ============================================================
    if (action === "normalize-all") {
      await db.query("begin");
      try {
        // 1) Load all categories, group by normalized key
        const catsRes = await db.query<CategoryRow>(
          `select key, name_en, name_ar, sort_order, is_active, is_promoted
             from categories
            order by sort_order asc, key asc`
        );

        const groups = new Map<string, CategoryRow[]>();
        for (const row of catsRes.rows) {
          const target = normalizeKey(row.key);
          if (!target) continue;
          const list = groups.get(target) || [];
          list.push(row);
          groups.set(target, list);
        }

        // 2) For each normalized group: ensure target exists, merge others, update metadata
        for (const [target, rows] of groups.entries()) {
          if (!target) continue;

          // already normalized and no duplicates
          if (rows.length === 1 && String(rows[0].key) === target) continue;

          const targetExists = rows.some((r) => String(r.key) === target);

          // If target doesn't exist, rename the first row to target
          if (!targetExists && rows.length) {
            const firstKey = String(rows[0].key);
            if (firstKey && firstKey !== target) {
              await db.query(`update categories set key=$2 where key=$1`, [firstKey, target]);
            }
          }

          // Merge all other keys into target
          for (const r of rows) {
            const oldKey = String(r.key);
            if (!oldKey || oldKey === target) continue;

            const merge = mergeCategoryKeySql(oldKey, target);
            await db.query(merge.updateProducts[0], merge.updateProducts[1]);
            await db.query(merge.updatePromotions[0], merge.updatePromotions[1]);
            await db.query(`delete from categories where key=$1`, [oldKey]);
          }

          // Update metadata on the target row (keep best-of merged)
          const mergedNameEn = pickFirstNonEmpty(
            rows.map((r) => (String(r.key) === target ? r.name_en : "")).concat(rows.map((r) => r.name_en))
          );
          const mergedNameAr = pickFirstNonEmpty(
            rows.map((r) => (String(r.key) === target ? r.name_ar : "")).concat(rows.map((r) => r.name_ar))
          );

          const mergedSort = Math.min(...rows.map((r) => Number.isFinite(r.sort_order) ? r.sort_order : 0));
          const mergedActive = rows.some((r) => r.is_active === true);
          const mergedPromoted = rows.some((r) => r.is_promoted === true);

          await db.query(
            `update categories
                set name_en=$2,
                    name_ar=$3,
                    sort_order=$4,
                    is_active=$5,
                    is_promoted=$6,
                    updated_at=now()
              where key=$1`,
            [target, mergedNameEn || target, mergedNameAr || target, mergedSort, mergedActive, mergedPromoted]
          );
        }

        // 3) Normalize products.category_key values (even if they point to old variants)
        const prodKeysRes = await db.query<{ category_key: string }>(
          `select distinct category_key from products`
        );

        for (const r of prodKeysRes.rows) {
          const oldKey = String(r.category_key || "").trim();
          if (!oldKey) continue;
          const nk = normalizeKey(oldKey);
          if (!nk || nk === oldKey) continue;

          await db.query(
            `update products
                set category_key=$2,
                    updated_at=now()
              where category_key=$1`,
            [oldKey, nk]
          );
        }

        // 4) Normalize promotions.category_keys arrays (dedupe + normalize)
        const promoRes = await db.query<PromoKeysRow>(
          `select id::int as id, category_keys
             from promotions
            where category_keys is not null`
        );

        for (const pr of promoRes.rows) {
          const raw = Array.isArray(pr.category_keys) ? pr.category_keys : [];
          const normalized = uniqPreserveOrder(
            raw.map((k) => normalizeKey(k)).filter((k) => !!k)
          );

          // If array becomes empty, store NULL for cleanliness
          if (normalized.length === 0) {
            await db.query(
              `update promotions
                  set category_keys=null,
                      updated_at=now()
                where id=$1`,
              [pr.id]
            );
            continue;
          }

          await db.query(
            `update promotions
                set category_keys=$2::text[],
                    updated_at=now()
              where id=$1`,
            [pr.id, normalized]
          );
        }

        await db.query("commit");
      } catch (e: unknown) {
        await db.query("rollback");
        throw e;
      }

      return catalogSavedRedirect(req, form);
    }

    // ============================================================
    // CREATE
    // ============================================================
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

      // Merge legacy key variants into the normalized key (if they exist)
      if (key && candidates.length) {
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
            const target = await db.query(`select 1 from categories where key=$1 limit 1`, [key]);
            const hasTarget = (target.rowCount ?? 0) > 0;

            const remaining = existingKeys.slice();
            if (!hasTarget) {
              const first = remaining.shift();
              if (first) {
                await db.query(`update categories set key=$2 where key=$1`, [first, key]);
              }
            }

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

    // ============================================================
    // UPDATE
    // ============================================================
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

    // ============================================================
    // DELETE
    // ============================================================
    if (action === "delete") {
      const candidates = keyCandidates(form.get("key"));
      if (!candidates.length) return catalogErrorRedirect(req, form, "invalid-category");

      let deleted = false;
      for (const key of candidates) {
        await db.query("begin");
        try {
          await db.query(`update products set category_key='perfume' where category_key=$1`, [key]);

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

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/categories] route error", error);
    return catalogErrorRedirect(req, form, "category-save-failed");
  }
}
