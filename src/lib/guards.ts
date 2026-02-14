export function requireAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN || "";
  if (!token) return { ok: false as const, error: "Missing ADMIN_TOKEN on server" };

  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  const cookie = req.headers.get("cookie") || "";
  const cookieToken =
    cookie
      .split(";")
      .map((v) => v.trim())
      .find((part) => part.startsWith("admin_token="))
      ?.slice("admin_token=".length) || "";

  const got = bearer || decodeURIComponent(cookieToken);
  if (!got || got !== token) return { ok: false as const, error: "Unauthorized" };
  return { ok: true as const };
}
