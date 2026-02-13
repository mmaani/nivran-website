export type ReserveItem = { skuOrProductId: string; qty: number };

export async function reserveStock(_items: ReserveItem[]) {
  // MVP placeholder: implement DB reservation logic later.
  return { ok: true };
}
