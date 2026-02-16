import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductImageRow = {
  id: number;
  content_type: string | null;
  bytes: Buffer | Uint8Array;
  filename: string | null;
};

export async function GET(_: Request, { params }: { params: Promise<{ id?: string }> }) {
  await ensureCatalogTables();

  const resolved = await params;
  const id = Number(resolved?.id || 0);
  if (!id) return new Response("Not found", { status: 404 });

  const r = await db.query<ProductImageRow>(
    `select id, content_type, bytes, filename
       from product_images
      where id=$1
      limit 1`,
    [id]
  );

  const row = r.rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  const contentType = String(row.content_type || "application/octet-stream");

  // row.bytes may be Buffer or Uint8Array depending on driver/runtime
  const buf: Buffer = Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);

  // ✅ Use Uint8Array as BodyInit (avoids ArrayBuffer|SharedArrayBuffer typing)
  const body = new Uint8Array(buf);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(buf.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
      "content-disposition": `inline; filename="${encodeURIComponent(
        String(row.filename || `image-${id}`)
      )}"`,
    },
  });
}
