import { NextResponse } from "next/server";
import { isDbConnectivityError } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import {
  DEFAULT_BASE_SHIPPING_JOD,
  DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
  readFreeShippingThresholdJod,
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

    const shippingThreshold = await readFreeShippingThresholdJod();

    return NextResponse.json(
      {
        ok: true,
        thresholdJod: shippingThreshold.value,
        baseShippingJod: DEFAULT_BASE_SHIPPING_JOD,
        fallback: shippingThreshold.fallback,
        reason: shippingThreshold.reason,
      },
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
