export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN || "";
  if (!token) return { ok: false, error: "Missing ADMIN_TOKEN on server" };

  const header = req.headers.get("authorization") || "";
  const got = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!got || got !== token) return { ok: false, error: "Unauthorized" };
  return { ok: true };
}
