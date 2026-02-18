import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function catalogErrorRedirect(req: Request, code: string) {
  return NextResponse.redirect(new URL(`/admin/catalog?error=${encodeURIComponent(code)}`, req.url), 303);
}

function redirect303(req: Request, path: string) {
  return NextResponse.redirect(new URL(path, req.url), 303);
}

function unauthorized(req: Request) {
  const accept = req.headers.get("accept") || "";
  const isBrowser = accept.includes("text/html");
  if (isBrowser) {
    const next = "/admin/catalog";
    return redirect303(req, `/admin/login?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  try {
    const auth = requireAdmin(req);
    if (!auth.ok) return unauthorized(req);

    await ensureCatalogTablesSafe();

    const form = await req.formData();
    const productId = Number(form.get("product_id") || 0);
    if (!productId) return catalogErrorRedirect(req, "missing-product");

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

    return redirect303(req, "/admin/catalog?uploaded=1");
  } catch (error: unknown) {
    console.error("[admin/catalog/product-images] route error", error);
    return catalogErrorRedirect(req, "image-upload-failed");
  }
}
