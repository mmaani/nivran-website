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

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return unauthorized(req, auth.status, auth.error);

  await ensureCatalogTables();

  const form = await req.formData();
  const productId = Number(form.get("product_id") || 0);
  if (!productId) {
    return NextResponse.redirect(new URL("/admin/catalog?error=missing-product", req.url));
  }

  // Files come as `File` objects.
  const files = form.getAll("images").filter(Boolean) as unknown as File[];
  const selected = files.slice(0, 5); // enforce max 5

  // Replace behavior (simple + predictable)
  await db.query(`delete from product_images where product_id=$1`, [productId]);

  for (let i = 0; i < selected.length; i++) {
    const f = selected[i];
    const contentType = String((f as any)?.type || "application/octet-stream");
    const filename = String((f as any)?.name || `image-${i + 1}`);

    const ab = await (f as any).arrayBuffer();
    const buf = Buffer.from(ab);

    await db.query(
      `insert into product_images (product_id, "position", filename, content_type, bytes)
       values ($1,$2,$3,$4,$5)`,
      [productId, i, filename, contentType, buf]
    );
  }

  return NextResponse.redirect(new URL("/admin/catalog?uploaded=1", req.url));
}
