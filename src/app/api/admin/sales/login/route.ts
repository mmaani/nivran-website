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
