import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const files = (form.getAll("images") || []).filter(Boolean) as unknown as File[];
    const selected = files.slice(0, 5);

    await db.query(`delete from product_images where product_id=$1`, [productId]);

    for (let i = 0; i < selected.length; i += 1) {
      const f = selected[i];
      const contentType = String(f?.type || "application/octet-stream");
      const filename = String(f?.name || `image-${i + 1}`);

      const ab = await f.arrayBuffer();
      const buf = Buffer.from(ab);

      await db.query(
        `insert into product_images (product_id, "position", filename, content_type, bytes)
         values ($1,$2,$3,$4,$5)`,
        [productId, i, filename, contentType, buf]
      );
    }

    return catalogSavedRedirect(req, form, { uploaded: 1 });
  } catch (error: unknown) {
    console.error("[admin/catalog/product-images] route error", error);
    return catalogErrorRedirect(req, form, "image-upload-failed");
  }
}
