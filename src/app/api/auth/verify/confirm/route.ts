import { NextResponse } from "next/server";
import { ensureIdentityTables, getCustomerIdFromRequest, confirmEmailVerificationCode } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errMsg(locale: "en" | "ar", code: string) {
  const isAr = locale === "ar";
  switch (code) {
    case "INVALID_CODE":
      return isAr ? "رمز غير صالح." : "Invalid code format.";
    case "NO_ACTIVE_CODE":
      return isAr ? "لا يوجد رمز نشط. أعد الإرسال." : "No active code. Please resend.";
    case "EXPIRED":
      return isAr ? "انتهت صلاحية الرمز. أعد الإرسال." : "Code expired. Please resend.";
    case "TOO_MANY_ATTEMPTS":
      return isAr ? "محاولات كثيرة. أعد الإرسال لاحقًا." : "Too many attempts. Please resend later.";
    case "WRONG_CODE":
      return isAr ? "رمز غير صحيح." : "Wrong code.";
    default:
      return isAr ? "تعذر التحقق." : "Could not verify.";
  }
}

export async function POST(req: Request) {
  await ensureIdentityTables();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const locale = String(body?.locale || "en") === "ar" ? "ar" : "en";
  const code = String(body?.code || "").trim();

  const r = await confirmEmailVerificationCode(customerId, code);
  if (!r.ok) return NextResponse.json({ ok: false, error: errMsg(locale, r.error || "") }, { status: 400 });

  return NextResponse.json({ ok: true });
}
