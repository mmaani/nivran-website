import { NextRequest, NextResponse } from "next/server";

function safeEqHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hasSalesSession(req: NextRequest, secret: string): Promise<boolean> {
  const role = (req.cookies.get("nivran_admin_role")?.value || "").trim();
  const staffId = (req.cookies.get("nivran_staff_id")?.value || "").trim();
  const username = (req.cookies.get("nivran_staff_user")?.value || "").trim().toLowerCase();
  const sig = (req.cookies.get("nivran_staff_sig")?.value || "").trim();
  if (!(role === "sales" && !!staffId && !!username && !!sig && !!secret)) return false;

  const id = Number(staffId);
  if (!Number.isFinite(id) || id <= 0) return false;

  const payload = `${Math.trunc(id)}:${username}`;
  const expected = await signHmacSha256Hex(secret, payload);
  return safeEqHex(expected, sig);
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  return atob(padded);
}

async function signHmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

async function isValidAdminToken(token: string, secret: string): Promise<boolean> {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return false;

    const expected = await signHmacSha256Hex(secret, encodedPayload);
    if (!safeEqHex(expected, signature)) return false;

    const parsed: unknown = JSON.parse(decodeBase64Url(encodedPayload));
    if (typeof parsed !== "object" || parsed === null) return false;
    const record = parsed as Record<string, unknown>;
    if (record["role"] !== "admin") return false;
    const exp = record["exp"];
    if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return exp > nowSec;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const adminSecret = (process.env.ADMIN_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN || "").trim();
  const cookieToken = (req.cookies.get("admin_token")?.value || req.cookies.get("nivran_admin_token")?.value || "").trim();

  const isAdminRoute = path.startsWith("/admin");
  const isAdminApi = path.startsWith("/api/admin");
  const isAdminLoginPage = path === "/admin/login";
  const isAdminLoginApi = path === "/api/admin/login" || path === "/api/admin/sales/login";

  if (!isAdminRoute && !isAdminApi) return NextResponse.next();
  if (isAdminLoginPage || isAdminLoginApi) return NextResponse.next();

  const isAdmin = !!adminSecret && !!cookieToken && (await isValidAdminToken(cookieToken, adminSecret));
  const isSales = await hasSalesSession(req, adminSecret);

  if (!isAdmin && !isSales) {
    if (isAdminApi) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isSales) {
    const allowedAdminRoutes = path === "/admin/sales" || path.startsWith("/admin/sales/");
    const allowedApiRoutes =
      path.startsWith("/api/admin/sales") ||
      path.startsWith("/api/admin/refund") ||
      path === "/api/admin/logout" ||
      path === "/api/admin/lang";

    if (isAdminRoute && !allowedAdminRoutes) {
      return NextResponse.redirect(new URL("/admin/sales", req.url));
    }
    if (isAdminApi && !allowedApiRoutes) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
