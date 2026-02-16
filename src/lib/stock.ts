export type ReserveItem = { skuOrProductId: string; qty: number };

export async function reserveStock(_items: ReserveItem[]) {
  void _items;
  // MVP placeholder: implement DB reservation logic later.
  return { ok: true };
}
