import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ping = await db.query<{ now: string }>(`select now()::text as now`);
    const bootstrap = await ensureCatalogTablesSafe();

    return NextResponse.json({
      ok: true,
      db: "up",
      serverTime: ping.rows?.[0]?.now || null,
      mode: bootstrap.ok ? "db" : "fallback",
      catalogBootstrap: bootstrap.ok ? "ok" : "degraded",
      catalogBootstrapReason: bootstrap.ok ? null : bootstrap.reason,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    if (!isDbConnectivityError(error)) {
      return NextResponse.json(
        { ok: false, db: "error", mode: "error", reason: "unexpected", catalogBootstrap: "unavailable" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json({
      ok: true,
      db: "down",
      mode: "fallback",
      reason: "connectivity",
      catalogBootstrap: "unavailable",
      catalogBootstrapReason: "DB_CONNECTIVITY",
    }, { headers: { "cache-control": "no-store" } });
  }
}
