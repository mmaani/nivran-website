import { NextResponse } from "next/server";
import { authenticateSalesUser, makeSalesCookies } from "@/lib/adminSession";

export const runtime = "nodejs";

type Body = { email?: string; password?: string; rememberMe?: boolean };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const rememberMe = body.rememberMe === true;

  const auth = await authenticateSalesUser(email, password);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: "sales" });
  const clearOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
  // Ensure sales login cannot inherit an existing admin session.
  res.cookies.set("admin_token", "", clearOpts);
  res.cookies.set("nivran_admin_token", "", clearOpts);
  res.cookies.set("admin_token_client", "", clearOpts);

  for (const cookie of makeSalesCookies(auth.staffId, auth.username, rememberMe)) {
    res.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: cookie.maxAge,
    });
  }
  return res;
}
