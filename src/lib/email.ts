import { Resend } from "resend";

export type Locale = "en" | "ar";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim().length === 0) return null;
  return new Resend(key);
}

function getFrom(): string | null {
  const from = process.env.EMAIL_FROM;
  if (!from || from.trim().length === 0) return null;
  return from;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wrap(inner: string): string {
  return `
  <div style="background:#F5F2EC;padding:28px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:22px 20px;box-shadow:0 8px 26px rgba(0,0,0,.08);">
      <div style="font-family:Arial,sans-serif;color:#1B1B1B;">
        <div style="letter-spacing:.24em;font-weight:700;font-size:14px;margin-bottom:10px;">NIVRAN</div>
        ${inner}
      </div>
    </div>
  </div>
  `;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, locale: Locale = "en") {
  const resend = getResend();
  const from = getFrom();

  if (!resend || !from) {
    console.warn("[email] Missing RESEND_API_KEY or EMAIL_FROM; skipping reset email to:", to);
    return;
  }

  const isAr = locale === "ar";
  const subject = isAr ? "إعادة تعيين كلمة المرور — NIVRAN" : "Reset your NIVRAN password";

  const spamTip = isAr
    ? 'إذا وصل البريد إلى الرسائل غير الهامة/Spam، اختر "ليس بريدًا غير هام" أو انقله إلى صندوق الوارد لضمان وصول تحديثات الطلبات.'
    : 'If this email lands in Junk/Spam, please mark it as "Not junk/Not spam" and move it to your Inbox so you don’t miss order updates.';

  const inner = `
    <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;">
      ${escapeHtml(isAr ? "إعادة تعيين كلمة المرور" : "Reset your password")}
    </h1>
    <p style="margin:0 0 14px;color:#333;line-height:1.6;">
      ${escapeHtml(
        isAr
          ? "طلبت إعادة تعيين كلمة المرور لحسابك في NIVRAN. اضغط الزر أدناه لإكمال العملية."
          : "You requested a password reset for your NIVRAN account. Use the button below to continue."
      )}
    </p>

    <div style="margin:18px 0 10px;">
      <a href="${escapeHtml(resetUrl)}"
         style="background:#1B1B1B;color:#fff;padding:12px 18px;text-decoration:none;border-radius:10px;display:inline-block;">
         ${escapeHtml(isAr ? "إعادة تعيين كلمة المرور" : "Reset password")}
      </a>
    </div>

    <p style="margin:0 0 14px;color:#555;line-height:1.6;">
      ${escapeHtml(isAr ? "صلاحية الرابط محدودة وقد ينتهي قريبًا." : "This link expires soon.")}
    </p>

    <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(0,0,0,.08);color:#555;line-height:1.6;">
      <p style="margin:0 0 8px;">${escapeHtml(spamTip)}</p>
      <p style="margin:0;">${escapeHtml(isAr ? "— فريق NIVRAN" : "— NIVRAN Team")}</p>
    </div>
  `;

  await resend.emails.send({ from, to, subject, html: wrap(inner) });
}

export async function sendVerificationCodeEmail(to: string, code: string, locale: Locale) {
  const resend = getResend();
  const from = getFrom();

  if (!resend || !from) {
    console.warn("[email] Missing RESEND_API_KEY or EMAIL_FROM; skipping verification email to:", to, "code:", code);
    return;
  }

  const isAr = locale === "ar";
  const subject = isAr ? "رمز تأكيد البريد الإلكتروني — NIVRAN" : "Your NIVRAN verification code";

  const spamTip = isAr
    ? 'إذا وصل البريد إلى الرسائل غير الهامة/Spam، اختر "ليس بريدًا غير هام" أو انقله إلى صندوق الوارد لضمان وصول تحديثات الطلبات.'
    : 'If this email lands in Junk/Spam, please mark it as "Not junk/Not spam" and move it to your Inbox so you don’t miss order updates.';

  const inner = `
    <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;">
      ${escapeHtml(isAr ? "تأكيد بريدك الإلكتروني" : "Verify your email")}
    </h1>
    <p style="margin:0 0 14px;color:#333;line-height:1.6;">
      ${escapeHtml(isAr ? "استخدم رمز التحقق التالي لإكمال إنشاء حسابك." : "Use the verification code below to complete your signup.")}
    </p>

    <div style="margin:18px 0 10px;background:#F5F2EC;border-radius:14px;padding:14px 12px;text-align:center;">
      <div style="font-size:34px;letter-spacing:.25em;font-weight:800;">${escapeHtml(code)}</div>
    </div>

    <p style="margin:0 0 14px;color:#555;">
      ${escapeHtml(isAr ? "ينتهي خلال 10 دقائق." : "Expires in 10 minutes.")}
    </p>

    <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(0,0,0,.08);color:#555;line-height:1.6;">
      <p style="margin:0 0 8px;">${escapeHtml(spamTip)}</p>
      <p style="margin:0;">${escapeHtml(isAr ? "— فريق NIVRAN" : "— NIVRAN Team")}</p>
    </div>
  `;

  await resend.emails.send({ from, to, subject, html: wrap(inner) });
}
