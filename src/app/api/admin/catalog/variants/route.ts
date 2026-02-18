import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBool(v: FormDataEntryValue | null): boolean {
  return String(v || "") === "on";
}

function toNum(v: FormDataEntryValue | null): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  await ensureCatalogTables();
  const form = await req.formData();
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

    if (productId <= 0 || !label || price <= 0) {
      return NextResponse.redirect(new URL("/admin/catalog?error=invalid-variant", req.url));
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
          sizeMlRaw ? Math.max(0, Math.trunc(Number(sizeMlRaw))) : null,
          price,
          compareAtRaw ? Number(compareAtRaw) : null,
          isDefault,
          isActive,
          sortOrder,
        ]
      );
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

    if (id > 0 && productId > 0 && label && price > 0) {
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
            sizeMlRaw ? Math.max(0, Math.trunc(Number(sizeMlRaw))) : null,
            price,
            compareAtRaw ? Number(compareAtRaw) : null,
            isDefault,
            isActive,
            sortOrder,
          ]
        );
      });
    }
  }

  if (action === "delete") {
    const id = Number(form.get("id") || 0);
    if (id > 0) {
      await db.query(`delete from product_variants where id=$1`, [id]);
    }
  }

  return NextResponse.redirect(new URL("/admin/catalog?saved=1", req.url));
}
