import { NextResponse } from "next/server";
import { db, isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import {
  DEFAULT_BASE_SHIPPING_JOD,
  DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
  normalizeFreeShippingThreshold,
} from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bootstrap = await ensureCatalogTablesSafe();
    if (!bootstrap.ok) {
      return NextResponse.json(
        {
          ok: true,
          thresholdJod: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
          baseShippingJod: DEFAULT_BASE_SHIPPING_JOD,
          fallback: true,
          reason: bootstrap.reason,
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    const r = await db.query<{ value_number: string | number | null }>(
      `select value_number from store_settings where key='free_shipping_threshold_jod' limit 1`
    );
    const thresholdJod = normalizeFreeShippingThreshold(r.rows[0]?.value_number);

    return NextResponse.json(
      { ok: true, thresholdJod, baseShippingJod: DEFAULT_BASE_SHIPPING_JOD, fallback: false },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error: unknown) {
    if (isDbConnectivityError(error)) {
      return NextResponse.json(
        {
          ok: true,
          thresholdJod: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
          baseShippingJod: DEFAULT_BASE_SHIPPING_JOD,
          fallback: true,
          reason: "DB_CONNECTIVITY",
        },
        { headers: { "cache-control": "no-store" } }
      );
    }
    throw error;
  }
}
