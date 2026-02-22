import { NextResponse } from "next/server";
import { confirmEmailVerificationCode, ensureIdentityTables, getCustomerIdFromRequest } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = { code?: string; locale?: string };

export async function POST(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });

  const bodyUnknown: unknown = await req.json().catch(() => ({}));
  const body: ReqBody = typeof bodyUnknown === "object" && bodyUnknown !== null ? (bodyUnknown as ReqBody) : {};
  const code = typeof body.code === "string" ? body.code : "";

  const r = await confirmEmailVerificationCode(customerId, code);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "INVALID" }, { status: 400 });

  return NextResponse.json({ ok: true });
}
