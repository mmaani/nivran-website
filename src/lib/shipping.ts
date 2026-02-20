import "server-only";

export const DEFAULT_FREE_SHIPPING_THRESHOLD_JOD = 50;
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
