import "server-only";

import { db } from "@/lib/db";

export const DEFAULT_FREE_SHIPPING_THRESHOLD_JOD = 69;
export const DEFAULT_BASE_SHIPPING_JOD = 3.5;

export function normalizeFreeShippingThreshold(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FREE_SHIPPING_THRESHOLD_JOD;
}

export function shippingForSubtotal(subtotalAfterDiscount: number, hasItems: boolean, thresholdJod: number): number {
  if (!hasItems) return 0;
  if (thresholdJod > 0 && subtotalAfterDiscount >= thresholdJod) return 0;
  return DEFAULT_BASE_SHIPPING_JOD;
}

function isUndefinedTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code === "42P01";
}

export async function readFreeShippingThresholdJod(): Promise<{ value: number; fallback: boolean; reason?: string }> {
  try {
    const r = await db.query<{ value_number: string | number | null }>(
      `select value_number from store_settings where key='free_shipping_threshold_jod' limit 1`
    );
    return {
      value: normalizeFreeShippingThreshold(r.rows[0]?.value_number),
      fallback: false,
    };
  } catch (error: unknown) {
    if (isUndefinedTableError(error)) {
      return {
        value: DEFAULT_FREE_SHIPPING_THRESHOLD_JOD,
        fallback: true,
        reason: "STORE_SETTINGS_UNAVAILABLE",
      };
    }
    throw error;
  }
}
