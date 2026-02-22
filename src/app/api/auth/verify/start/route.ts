import { NextResponse } from "next/server";
import {
  ensureIdentityTables,
  getCustomerIdFromRequest,
  issueEmailVerificationCode,
} from "@/lib/identity";
import { db } from "@/lib/db";
import { sendVerificationCodeEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Locale = "en" | "ar";
type StartBody = { locale?: string };

function parseLocale(body: StartBody): Locale {
  return body.locale === "ar" ? "ar" : "en";
}

export async function POST(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const body: StartBody = await req.json().catch((): StartBody => ({}));
  const locale = parseLocale(body);

  const r = await db.query<{ email: string }>(
    "select email from customers where id = $1",
    [customerId],
  );
  const email = r.rows[0]?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // issueEmailVerificationCode should return: { code: string, expiresAt: Date }
  const v = await issueEmailVerificationCode(customerId);

  // Safe: email sender is build/dev friendly if env vars are missing.
  await sendVerificationCodeEmail(email, v.code, locale);

  return NextResponse.json({ ok: true });
}
