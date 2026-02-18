import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ping = await db.query<{ now: string }>(`select now()::text as now`);
    return NextResponse.json({
      ok: true,
      db: "up",
      serverTime: ping.rows?.[0]?.now || null,
      mode: "db",
    });
  } catch (error: unknown) {
    if (!isDbConnectivityError(error)) {
      return NextResponse.json({ ok: false, db: "error", mode: "error", reason: "unexpected" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      db: "down",
      mode: "fallback",
      reason: "connectivity",
    });
  }
}
