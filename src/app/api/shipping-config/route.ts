import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureCatalogTablesSafe();
    const r = await db.query<{ value_number: string | number | null }>(
      `select value_number from store_settings where key='free_shipping_threshold_jod' limit 1`
    );
    const thresholdJod = Number(r.rows[0]?.value_number || 35);
    return NextResponse.json({ ok: true, thresholdJod, baseShippingJod: 3.5 });
  } catch (error: unknown) {
    if (isDbConnectivityError(error)) {
      return NextResponse.json({ ok: true, thresholdJod: 35, baseShippingJod: 3.5, fallback: true });
    }
    throw error;
  }
}
