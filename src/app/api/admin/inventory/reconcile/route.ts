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

type VariantMapRow = {
  id: number;
  product_slug: string | null;
};

type ReconDelta = {
  raw: string | null;
  normalized: string | null;
  variantId: number | null;
  qty: number;
};

type ReconDeltaOut = {
  raw: string | null;
  normalized: string | null;
  resolved: string | null;
  resolvedVia: "DIRECT" | "NORMALIZED" | "VARIANT" | "MISSING";
  variantId: number | null;
  qty: number;
  current: number | null;
  after: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function toPosInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
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

function isSafeSlug(value: string): boolean {
  // Product slugs in this project are normalized (lowercase + hyphens).
  // This prevents sending junk candidates to Postgres.
  return /^[a-z0-9-]+$/.test(value);
}

function extractReconDeltas(itemsValue: unknown): ReconDelta[] {
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

  // Aggregate by (normalized slug) or (variantId) to avoid repeated lines.
  const map = new Map<string, ReconDelta>();

  for (const entry of list) {
    if (!isRecord(entry)) continue;

    const raw =
      toNonEmptyString(entry["slug"]) ||
      toNonEmptyString(entry["productSlug"]) ||
      toNonEmptyString(entry["product_slug"]) ||
      toNonEmptyString(entry["sku"]);

    const normalized = normalizeSkuForInventory(raw);
    const variantId = toPosInt(entry["variantId"] ?? entry["variant_id"]);
    const qty = toQty(entry["qty"]);

    const key = normalized ? `slug:${normalized}` : variantId ? `variant:${variantId}` : null;
    if (!key) continue;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, { raw, normalized, variantId, qty });
    } else {
      map.set(key, {
        raw: prev.raw || raw,
        normalized: prev.normalized || normalized,
        variantId: prev.variantId || variantId,
        qty: Math.max(1, Math.min(999, prev.qty + qty)),
      });
    }
  }

  return Array.from(map.values());
}

function buildCandidates(delta: ReconDelta, variantSlug: string | null): { list: string[]; variantSet: Set<string> } {
  const out: string[] = [];
  const variantSet = new Set<string>();

  const push = (v: string | null, markVariant: boolean) => {
    if (!v) return;
    const s = v.trim();
    if (!s) return;
    if (!isSafeSlug(s)) return;
    if (!out.includes(s)) out.push(s);
    if (markVariant) variantSet.add(s);
  };

  // Preferred: normalized
  push(delta.normalized, false);

  // Raw-derived candidates (may already be normalized)
  if (delta.raw) {
    const rawLower = delta.raw.trim().toLowerCase();
    push(rawLower, false);
    push(rawLower.replace(/_/g, "-"), false);
    push(rawLower.replace(/\s+/g, "-"), false);
    push(normalizeSkuForInventory(rawLower), false);
  }

  // Variant-derived candidates (only if we have variantSlug)
  if (variantSlug) {
    const v = variantSlug.trim();
    push(v, true);
    const vn = normalizeSkuForInventory(v);
    if (vn && vn !== v) push(vn, true);
  }

  return { list: out, variantSet };
}

async function loadVariantMap(trx: typeof db, ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!ids.length) return map;

  // Best-effort: variants table may not exist in some deployments.
  try {
    const r = await trx.query<VariantMapRow>(
      `select id::int as id, product_slug::text as product_slug
         from variants
        where id = any($1::int[])`,
      [ids]
    );

    for (const row of r.rows) {
      const slug = typeof row.product_slug === "string" ? row.product_slug.trim() : "";
      if (slug) map.set(row.id, slug);
    }
  } catch {
    // ignore
  }

  return map;
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

  const base = rows.map((r) => {
    const deltas = extractReconDeltas(r.items);
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

  // Collect variant IDs for best-effort resolution labels
  const variantIds = Array.from(
    new Set(
      base
        .flatMap((o) => o.deltas.map((d) => d.variantId))
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0)
    )
  );

  const variantMap = await loadVariantMap(db, variantIds);

  // Build candidate lists per delta + collect all candidates
  const perOrder = base.map((o) => {
    const expanded = o.deltas.map((d) => {
      const variantSlug = d.variantId ? variantMap.get(d.variantId) || null : null;
      const c = buildCandidates(d, variantSlug);
      return { d, candidates: c.list, variantSet: c.variantSet };
    });
    return { ...o, expanded };
  });

  const allCandidates = Array.from(
    new Set(
      perOrder
        .flatMap((o) => o.expanded.flatMap((x) => x.candidates))
        .filter((s) => typeof s === "string" && s.length > 0)
    )
  );

  const stockMap = new Map<string, number>();

  if (allCandidates.length) {
    const stockRes = await db.query<ProductStockRow>(
      `select slug::text as slug, inventory_qty
         from products
        where slug = any($1::text[])`,
      [allCandidates]
    );

    for (const p of stockRes.rows) {
      const qty = typeof p.inventory_qty === "number" && Number.isFinite(p.inventory_qty) ? p.inventory_qty : 0;
      stockMap.set(String(p.slug), qty);
    }
  }

  const enriched = perOrder.map((o) => {
    const deltas: ReconDeltaOut[] = o.expanded.map((x) => {
      const rawLower = x.d.raw ? x.d.raw.trim().toLowerCase() : null;
      const normalized = x.d.normalized;
      const resolved = x.candidates.find((c) => stockMap.has(c)) || null;

      const current = resolved && stockMap.has(resolved) ? (stockMap.get(resolved) as number) : null;
      const after = current == null ? null : Math.max(0, current - x.d.qty);

      let resolvedVia: ReconDeltaOut["resolvedVia"] = "MISSING";
      if (resolved) {
        if (x.variantSet.has(resolved)) {
          resolvedVia = "VARIANT";
        } else if (rawLower && normalized && rawLower === normalized) {
          resolvedVia = "DIRECT";
        } else {
          resolvedVia = "NORMALIZED";
        }
      }

      return {
        raw: x.d.raw,
        normalized,
        resolved,
        resolvedVia,
        variantId: x.d.variantId,
        qty: x.d.qty,
        current,
        after,
      };
    });

    return {
      id: o.id,
      cart_id: o.cart_id,
      status: o.status,
      payment_method: o.payment_method,
      created_at: o.created_at,
      inventory_committed_at: o.inventory_committed_at,
      deltas,
    };
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
