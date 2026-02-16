// src/lib/safe.ts

export type AnyRecord = Record<string, unknown>;

export function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function getString(obj: AnyRecord, key: string, fallback = ""): string {
  const v = obj[key];
  return typeof v === "string" ? v : fallback;
}

export function getNumber(obj: AnyRecord, key: string, fallback = 0): number {
  const v = obj[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getBool(obj: AnyRecord, key: string, fallback = false): boolean {
  const v = obj[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  }
  if (typeof v === "number") return v !== 0;
  return fallback;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
