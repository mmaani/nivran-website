import { Resend } from "resend";
import { logEmailSendAttempt } from "@/lib/emailLog";

export type Locale = "en" | "ar";

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim().length === 0) return null;
  return new Resend(key.trim());
}

function getEmailFrom(): string | null {
  const from = process.env.EMAIL_FROM;
  if (!from || from.trim().length === 0) return null;
  return from.trim();
}

function getEmailReplyTo(): string | null {
  const rt = process.env.EMAIL_REPLY_TO;
  if (!rt || rt.trim().length === 0) return null;
  return rt.trim();
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wrapEmailHtml(locale: Locale, inner: string): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const font = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>NIVRAN</title>
  </head>
  <body style="margin:0;background:#F5F2EC;font-family:${font};">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid rgba(0,0,0,.08);border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.06);overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid rgba(0,0,0,.06);">
          <div style="letter-spacing:.28em;font-weight:700;color:#1B1B1B;">NIVRAN</div>
          <div style="margin-top:6px;color:#666;font-size:13px;">Wear the calm.</div>
        </div>
        <div style="padding:20px;">
          ${inner}
        </div>
        <div style="padding:16px 20px;border-top:1px solid rgba(0,0,0,.06);color:#666;font-size:12px;line-height:1.6;">
          ${locale === "ar"
            ? "إذا وصل البريد إلى الرسائل غير الهامة/Spam، اختر «ليس بريدًا غير هام» أو انقله إلى صندوق الوارد لضمان وصول تحديثات الطلبات."
            : "If this email lands in Junk/Spam, mark it as “Not junk/Not spam” and move it to your Inbox so you don’t miss order updates."}
        </div>
      </div>
      <div style="padding:14px 6px;color:#888;font-size:12px;line-height:1.6;text-align:center;">
        ${locale === "ar" ? "— فريق NIVRAN" : "— NIVRAN Team"}
      </div>
    </div>
  </body>
</html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SendMeta = {
  template: "password_reset" | "verification_code";
  locale: Locale;
};

async function sendHtml(to: string, subject: string, htmlInner: string, locale: Locale, meta: SendMeta): Promise<void> {
  const resend = getResendClient();
  const from = getEmailFrom();
  const replyTo = getEmailReplyTo();

  if (!resend || !from) {
    console.warn("[email] missing RESEND_API_KEY or EMAIL_FROM; skipping send to", to, "subject:", subject);
    await logEmailSendAttempt({
      to,
      subject,
      template: meta.template,
      locale: meta.locale,
      status: "SKIPPED",
      error: "MISSING_RESEND_OR_FROM",
    });
    return;
  }

  const maxAttempts = 3;
  let lastErr: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await resend.emails.send({
        from,
        to,
        subject,
        html: wrapEmailHtml(locale, htmlInner),
        replyTo: replyTo ?? undefined, // ✅ correct key is replyTo
      });

      await logEmailSendAttempt({
        to,
        subject,
        template: meta.template,
        locale: meta.locale,
        status: "SENT",
        attempt,
      });

      return;
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : "UNKNOWN_ERROR";
      console.warn("[email] send failed attempt", attempt, "to", to, "subject:", subject, "err:", lastErr);

      await logEmailSendAttempt({
        to,
        subject,
        template: meta.template,
        locale: meta.locale,
        status: "FAILED",
        attempt,
        error: lastErr,
      });

      // Backoff: 300ms, 900ms, 1800ms
      const backoff = attempt === 1 ? 300 : attempt === 2 ? 900 : 1800;
      if (attempt < maxAttempts) await sleep(backoff);
    }
  }

  // After retries: fail silently for UX, but we logged it.
  console.warn("[email] failed after retries:", lastErr);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, locale: Locale = "en"): Promise<void> {
  const subject = locale === "ar" ? "إعادة تعيين كلمة المرور — NIVRAN" : "Reset your password — NIVRAN";
  const btnText = locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset password";
  const intro =
    locale === "ar"
      ? "تلقّينا طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك."
      : "We received a request to reset your account password.";
  const note =
    locale === "ar"
      ? "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان."
      : "If you didn’t request this, you can safely ignore this email.";

  const inner = `
    <p style="margin:0 0 12px;color:#1B1B1B;line-height:1.7;">${escapeHtml(intro)}</p>
    <div style="margin:16px 0;">
      <a href="${escapeHtml(resetUrl)}"
         style="display:inline-block;background:#1B1B1B;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;">
        ${escapeHtml(btnText)}
      </a>
    </div>
    <p style="margin:12px 0 0;color:#555;line-height:1.7;">${escapeHtml(note)}</p>
    <p style="margin:14px 0 0;color:#777;font-size:12px;line-height:1.6;">
      ${escapeHtml(resetUrl)}
    </p>
  `;

  await sendHtml(to, subject, inner, locale, { template: "password_reset", locale });
}

export async function sendVerificationCodeEmail(to: string, code: string, locale: Locale): Promise<void> {
  const subject = locale === "ar" ? "رمز التحقق — NIVRAN" : "Your verification code — NIVRAN";
  const intro =
    locale === "ar"
      ? "أكمل إنشاء حسابك باستخدام رمز التحقق التالي:"
      : "Finish setting up your account with this verification code:";
  const expires = locale === "ar" ? "ينتهي خلال 10 دقائق." : "Expires in 10 minutes.";

  const inner = `
    <p style="margin:0 0 14px;color:#1B1B1B;line-height:1.7;">${escapeHtml(intro)}</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:.20em;color:#1B1B1B;background:#F7F6F2;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:14px 16px;display:inline-block;">
      ${escapeHtml(code)}
    </div>
    <p style="margin:14px 0 0;color:#555;line-height:1.7;">${escapeHtml(expires)}</p>
    <p style="margin:12px 0 0;color:#777;font-size:12px;line-height:1.6;">
      ${locale === "ar"
        ? "إذا لم تحاول إنشاء حساب، تجاهل هذه الرسالة."
        : "If you didn’t try to create an account, ignore this email."}
    </p>
  `;

  await sendHtml(to, subject, inner, locale, { template: "verification_code", locale });
}
