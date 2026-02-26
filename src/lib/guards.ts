import { readSalesFromRequest, verifyAdminFromRequest } from "@/lib/adminSession";

export type AdminAuth =
  | { ok: true; role: "admin" }
  | { ok: false; status: number; error: string };

export type AdminOrSalesAuth =
  | { ok: true; role: "admin" | "sales"; staffId: number | null; username: string | null }
  | { ok: false; status: number; error: string };

export function requireAdmin(req: Request): AdminAuth {
  if (verifyAdminFromRequest(req)) return { ok: true, role: "admin" };
  return { ok: false, status: 401, error: "Unauthorized" };
}

export function requireAdminOrSales(req: Request): AdminOrSalesAuth {
  if (verifyAdminFromRequest(req)) return { ok: true, role: "admin", staffId: null, username: null };
  const sales = readSalesFromRequest(req);
  if (sales) return { ok: true, role: "sales", staffId: sales.staffId, username: sales.username };
  return { ok: false, status: 401, error: "Unauthorized" };
}
