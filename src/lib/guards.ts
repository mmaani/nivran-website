// src/lib/guards.ts
export type AdminAuth =
  | { ok: true }
  | { ok: false; status: number; error: string };

function readCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.toLowerCase().startsWith(name.toLowerCase() + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return "";
}

export function requireAdmin(req: Request): AdminAuth {
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) {
    return { ok: false, status: 500, error: "Server misconfigured: ADMIN_TOKEN missing" };
  }

  const headerToken = (req.headers.get("x-admin-token") || "").trim();
  const authHeader = (req.headers.get("authorization") || "").trim();
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const cookieHeader = req.headers.get("cookie") || "";
  const cookieToken =
    readCookie(cookieHeader, "admin_token") ||
    readCookie(cookieHeader, "nivran_admin_token");

  const got = headerToken || bearer || cookieToken;

  if (!got || got !== expected) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
