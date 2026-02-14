// src/lib/guards.ts
type AdminAuthOk = { ok: true };
type AdminAuthFail = { ok: false; status: number; error: string };
export type AdminAuthResult = AdminAuthOk | AdminAuthFail;

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;

  // "a=b; c=d"
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

function extractAdminToken(req: Request): string {
  // 1) custom header (your client fetch)
  const xAdmin = (req.headers.get("x-admin-token") || "").trim();
  if (xAdmin) return xAdmin;

  // 2) Authorization: Bearer <token>
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice("bearer ".length).trim();
    if (t) return t;
  }

  // 3) Cookie set by /api/admin/login (browser forms)
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const cookieToken = (cookies["admin_token"] || "").trim();
  if (cookieToken) return cookieToken;

  return "";
}

export function requireAdmin(req: Request): AdminAuthResult {
  const expected = (process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return { ok: false, status: 500, error: "ADMIN_TOKEN is not set on the server" };

  const got = extractAdminToken(req);
  if (!got) return { ok: false, status: 401, error: "Missing admin token" };

  if (got !== expected) return { ok: false, status: 403, error: "Invalid admin token" };

  return { ok: true };
}
