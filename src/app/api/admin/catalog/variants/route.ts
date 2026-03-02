import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { logAdminAudit } from "@/lib/adminAudit";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBool(v: FormDataEntryValue | null): boolean {
  return String(v || "") === "on";
}

function toNum(v: FormDataEntryValue | null): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalMoney(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

async function hasDuplicateVariantLabel(productId: number, label: string, excludeId?: number): Promise<boolean> {
  const params: Array<number | string> = [productId, label.trim().toLowerCase()];
  let sql = `select id from product_variants where product_id=$1 and lower(label)=\$2`;
  if (excludeId && excludeId > 0) {
    params.push(excludeId);
    sql += ` and id<>\$3`;
  }
  sql += ` limit 1`;
  const found = await db.query<{ id: number }>(sql, params);
  return Boolean(found.rows[0]);
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
      const productId = Number(form.get("product_id") || 0);
      const label = String(form.get("label") || "").trim();
      const price = toNum(form.get("price_jod"));
      const compareAtRaw = String(form.get("compare_at_price_jod") || "").trim();
      const sizeMlRaw = String(form.get("size_ml") || "").trim();
      const sortOrder = Math.max(0, Math.trunc(toNum(form.get("sort_order"))));
      const isActive = toBool(form.get("is_active"));
      const isDefault = toBool(form.get("is_default"));
      const compareAt = parseOptionalMoney(compareAtRaw);
      const sizeMl = sizeMlRaw ? Math.max(0, Math.trunc(Number(sizeMlRaw))) : null;

      if (productId <= 0 || !label || price <= 0) {
        return catalogErrorRedirect(req, form, "invalid-variant");
      }
      if (compareAt != null && compareAt > 0 && compareAt < price) {
        return catalogErrorRedirect(req, form, "invalid-compare-price");
      }
      if (sizeMlRaw && !Number.isFinite(Number(sizeMlRaw))) {
        return catalogErrorRedirect(req, form, "invalid-size-ml");
      }
      if (await hasDuplicateVariantLabel(productId, label)) {
        return catalogErrorRedirect(req, form, "duplicate-variant-label");
      }

      await db.withTransaction(async (trx) => {
        if (isDefault) {
          await trx.query(`update product_variants set is_default=false where product_id=$1`, [productId]);
        }

        await trx.query(
          `insert into product_variants
            (product_id, label, size_ml, price_jod, compare_at_price_jod, is_default, is_active, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            productId,
            label,
            sizeMl,
            price,
            compareAt,
            isDefault,
            isActive,
            sortOrder,
          ]
        );
        await logAdminAudit(trx, req, {
          adminId: "admin",
          action: "catalog.variant.create",
          entity: "variant",
          entityId: `${productId}:${label.toLowerCase()}`,
          metadata: { productId, label, isDefault, isActive, sortOrder },
        });
      });
    }

    if (action === "update") {
      const id = Number(form.get("id") || 0);
      const productId = Number(form.get("product_id") || 0);
      const label = String(form.get("label") || "").trim();
      const price = toNum(form.get("price_jod"));
      const compareAtRaw = String(form.get("compare_at_price_jod") || "").trim();
      const sizeMlRaw = String(form.get("size_ml") || "").trim();
      const sortOrder = Math.max(0, Math.trunc(toNum(form.get("sort_order"))));
      const isActive = toBool(form.get("is_active"));
      const isDefault = toBool(form.get("is_default"));
      const compareAt = parseOptionalMoney(compareAtRaw);
      const sizeMl = sizeMlRaw ? Math.max(0, Math.trunc(Number(sizeMlRaw))) : null;

      if (id > 0 && productId > 0 && label && price > 0) {
        if (compareAt != null && compareAt > 0 && compareAt < price) {
          return catalogErrorRedirect(req, form, "invalid-compare-price");
        }
        if (sizeMlRaw && !Number.isFinite(Number(sizeMlRaw))) {
          return catalogErrorRedirect(req, form, "invalid-size-ml");
        }
        if (await hasDuplicateVariantLabel(productId, label, id)) {
          return catalogErrorRedirect(req, form, "duplicate-variant-label");
        }
        await db.withTransaction(async (trx) => {
          if (isDefault) {
            await trx.query(`update product_variants set is_default=false where product_id=$1`, [productId]);
          }

          await trx.query(
            `update product_variants
                set label=$3,
                    size_ml=$4,
                    price_jod=$5,
                    compare_at_price_jod=$6,
                    is_default=$7,
                    is_active=$8,
                    sort_order=$9,
                    updated_at=now()
              where id=$1 and product_id=$2`,
            [
              id,
              productId,
              label,
              sizeMl,
              price,
              compareAt,
              isDefault,
              isActive,
              sortOrder,
            ]
          );
          await logAdminAudit(trx, req, {
            adminId: "admin",
            action: "catalog.variant.update",
            entity: "variant",
            entityId: String(id),
            metadata: { productId, label, isDefault, isActive, sortOrder },
          });
        });
      }
    }


    if (action === "set-default") {
      const id = Number(form.get("id") || 0);
      const productId = Number(form.get("product_id") || 0);
      if (id > 0 && productId > 0) {
        await db.withTransaction(async (trx) => {
          await trx.query(`update product_variants set is_default=false where product_id=$1`, [productId]);
          await trx.query(`update product_variants set is_default=true, updated_at=now() where id=$1 and product_id=$2`, [id, productId]);
          await logAdminAudit(trx, req, {
            adminId: "admin",
            action: "catalog.variant.set_default",
            entity: "variant",
            entityId: String(id),
            metadata: { productId },
          });
        });
      }
    }

    if (action === "delete") {
      const id = Number(form.get("id") || 0);
      if (id > 0) {
        await db.withTransaction(async (trx) => {
          await trx.query(`delete from product_variants where id=$1`, [id]);
          await logAdminAudit(trx, req, {
            adminId: "admin",
            action: "catalog.variant.delete",
            entity: "variant",
            entityId: String(id),
            metadata: {},
          });
        });
      }
    }

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/variants] route error", error);
    return catalogErrorRedirect(req, form, "variant-save-failed");
  }
}
