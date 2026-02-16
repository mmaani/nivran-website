import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { fetchAdminCustomers } from "@/lib/adminCustomers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(v: string | null, fallback: number): number {
  const n = Number(v || fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const page = toInt(url.searchParams.get("page"), 1);
  const pageSize = toInt(url.searchParams.get("pageSize"), 25);

  const data = await fetchAdminCustomers(page, pageSize);

  return NextResponse.json({
    ok: true,
    ...data,
    hasNext: data.page * data.pageSize < data.total,
    hasPrev: data.page > 1,
  });
}
