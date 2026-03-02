import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { logAdminAudit } from "@/lib/adminAudit";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

    const productId = Number(form.get("product_id") || 0);
    if (!productId) return catalogErrorRedirect(req, form, "missing-product");

    const p = await db.query<{ id: number }>(`select id::int as id from products where id=$1::bigint limit 1`, [productId]);
    if (!p.rows[0]) return catalogErrorRedirect(req, form, "product-not-found");

    const files = (form.getAll("images") || []).filter(Boolean) as unknown as File[];
    const selected = files.slice(0, MAX_IMAGE_COUNT);
    if (!selected.length) {
      return catalogErrorRedirect(req, form, "missing-image");
    }

    for (const file of selected) {
      if (!String(file?.type || "").toLowerCase().startsWith("image/")) {
        return catalogErrorRedirect(req, form, "invalid-image-type");
      }
      if (!Number.isFinite(file?.size) || file.size <= 0) {
        return catalogErrorRedirect(req, form, "invalid-image-file");
      }
      if (typeof file?.size === "number" && file.size > MAX_IMAGE_BYTES) {
        return catalogErrorRedirect(req, form, "image-too-large");
      }
    }
    await db.withTransaction(async (trx) => {
      await trx.query(`delete from product_images where product_id=$1`, [productId]);

      for (let i = 0; i < selected.length; i += 1) {
        const f = selected[i];
        const contentType = String(f?.type || "application/octet-stream");
        const filename = String(f?.name || `image-${i + 1}`);

        const ab = await f.arrayBuffer();
        const buf = Buffer.from(ab);

        await trx.query(
          `insert into product_images (product_id, "position", filename, content_type, bytes)
           values ($1,$2,$3,$4,$5)`,
          [productId, i, filename, contentType, buf]
        );
      }

      await logAdminAudit(trx, req, {
        adminId: "admin",
        action: "catalog.product_images.replace",
        entity: "product",
        entityId: String(productId),
        metadata: {
          uploadedCount: selected.length,
          maxAllowed: MAX_IMAGE_COUNT,
        },
      });
    });

    return catalogSavedRedirect(req, form, { uploaded: 1 });
  } catch (error: unknown) {
    console.error("[admin/catalog/product-images] route error", error);
    return catalogErrorRedirect(req, form, "image-upload-failed");
  }
}
