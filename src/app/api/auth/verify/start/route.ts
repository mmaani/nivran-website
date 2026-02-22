import { NextResponse } from "next/server";
import { ensureIdentityTables, getCustomerIdFromRequest, issueEmailVerificationCode } from "@/lib/identity";
import { db } from "@/lib/db";
import { sendVerificationCodeEmail, type Locale } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });

  const body: unknown = await req.json().catch(() => ({}));
  const locale: Locale =
    typeof body === "object" && body !== null && "locale" in body && String((body as Record<string, unknown>).locale) === "ar"
      ? "ar"
      : "en";

  const r = await db.query<{ email: string }>(`select email from customers where id = $1`, [customerId]);
  const email = r.rows[0]?.email;
  if (!email) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const v = await issueEmailVerificationCode(customerId);

  // Will no-op (not throw) if env missing
  await sendVerificationCodeEmail(email, v.code, locale);

  return NextResponse.json({ ok: true });
}
