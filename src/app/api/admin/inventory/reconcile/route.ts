import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureOrdersTables, commitInventoryForPaidOrderId, normalizeSkuForInventory } from "@/lib/orders";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

type ReconOrderRow = {
  id: number;
  cart_id: string;
  status: string;
  payment_method: string;
  created_at: string;
  inventory_committed_at: string | null;
  items: unknown;
};

type ProductStockRow = {
  slug: string;
  inventory_qty: number | null;
};

type InventoryDelta = { slug: string; qty: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toQty(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.trunc(n)));
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const s = value.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

function extractInventoryDeltas(itemsValue: unknown): InventoryDelta[] {
  const parsed = parseJsonIfString(itemsValue);

  const list: unknown =
    Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed["items"])
        ? parsed["items"]
        : isRecord(parsed) && Array.isArray(parsed["lines"])
          ? parsed["lines"]
          : null;

  if (!Array.isArray(list)) return [];

  const map = new Map<string, number>();

  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const raw =
      toNonEmptyString(entry["slug"]) ||
      toNonEmptyString(entry["productSlug"]) ||
      toNonEmptyString(entry["product_slug"]) ||
      toNonEmptyString(entry["sku"]);

    const slug = normalizeSkuForInventory(raw);
    if (!slug) continue;
    const qty = toQty(entry["qty"]);
    map.set(slug, (map.get(slug) || 0) + qty);
  }

  return Array.from(map.entries()).map(([slug, qty]) => ({ slug, qty }));
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  await ensureOrdersTables();

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(200, toInt(limitRaw) ?? 50));

  const countRes = await db.query<{ c: string }>(
    `select count(*)::text as c
       from orders
      where status in ('PAID','PAID_COD')
        and inventory_committed_at is null`
  );
  const totalPending = toInt(countRes.rows[0]?.c) ?? 0;

  const { rows } = await db.query<ReconOrderRow>(
    `select id,
            cart_id,
            status,
            payment_method,
            created_at::text as created_at,
            inventory_committed_at::text as inventory_committed_at,
            items
       from orders
      where status in ('PAID','PAID_COD')
        and inventory_committed_at is null
      order by created_at desc
      limit $1`,
    [limit]
  );

  const orders = rows.map((r) => {
    const deltas = extractInventoryDeltas(r.items);
    return {
      id: r.id,
      cart_id: r.cart_id,
      status: r.status,
      payment_method: r.payment_method,
      created_at: r.created_at,
      inventory_committed_at: r.inventory_committed_at,
      deltas,
    };
  });

  const slugs = Array.from(
    new Set(
      orders
        .flatMap((o) => o.deltas.map((d) => d.slug))
        .filter((s) => typeof s === "string" && s.length > 0)
    )
  );

  const stockMap = new Map<string, number>();

  if (slugs.length) {
    const stockRes = await db.query<ProductStockRow>(
      `select slug, inventory_qty
         from products
        where slug = any($1::text[])`,
      [slugs]
    );

    for (const p of stockRes.rows) {
      const qty = typeof p.inventory_qty === "number" && Number.isFinite(p.inventory_qty) ? p.inventory_qty : 0;
      stockMap.set(String(p.slug), qty);
    }
  }

  const enriched = orders.map((o) => {
    const deltas = o.deltas.map((d) => {
      const current = stockMap.has(d.slug) ? (stockMap.get(d.slug) as number) : null;
      return {
        slug: d.slug,
        qty: d.qty,
        current,
        after: current == null ? null : Math.max(0, current - d.qty),
      };
    });

    return { ...o, deltas };
  });

  return NextResponse.json({ ok: true, totalPending, rows: enriched });
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  await ensureOrdersTables();

  const parsed: unknown = await req.json().catch(() => ({}));
  const body = isRecord(parsed) ? parsed : {};

  const mode = typeof body["mode"] === "string" ? String(body["mode"]).toUpperCase() : "ONE";

  if (mode === "ALL") {
    const limit = Math.max(1, Math.min(100, toInt(body["limit"]) ?? 25));

    const r = await db.query<{ id: number }>(
      `select id
         from orders
        where status in ('PAID','PAID_COD')
          and inventory_committed_at is null
        order by created_at asc
        limit $1`,
      [limit]
    );

    const ids = r.rows.map((x) => x.id);
    const results: Array<{ id: number; committed: boolean }> = [];

    for (const id of ids) {
      const committed = await db.withTransaction(async (trx) => {
        return commitInventoryForPaidOrderId(trx, id);
      });
      results.push({ id, committed });
    }

    return NextResponse.json({ ok: true, mode: "ALL", results });
  }

  const orderId = toInt(body["orderId"] ?? body["id"]);
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId is required" }, { status: 400 });
  }

  const committed = await db.withTransaction(async (trx) => {
    return commitInventoryForPaidOrderId(trx, orderId);
  });

  return NextResponse.json({ ok: true, mode: "ONE", id: orderId, committed });
}
