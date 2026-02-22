import { Resend } from "resend";

/**
 * Transactional email sender for customer auth flows (reset password, verification).
 * Requires:
 * - RESEND_API_KEY
 * - EMAIL_FROM (e.g. 'NIVRAN <hello@send.nivran.com>' or 'NIVRAN <hello@nivran.com>')
 */
const resend = new Resend(process.env.RESEND_API_KEY);

function safeFrom(): string {
  // Allow either a raw address or "Brand <address>"
  const v = String(process.env.EMAIL_FROM || "").trim();
  return v || "NIVRAN <hello@send.nivran.com>";
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, locale: "en" | "ar" = "en") {
  const isAr = locale === "ar";
  const subject = isAr ? "إعادة تعيين كلمة مرور NIVRAN" : "Reset your NIVRAN password";

  const btn = isAr ? "إعادة تعيين كلمة المرور" : "Reset password";
  const intro = isAr
    ? "لقد تلقّينا طلبًا لإعادة تعيين كلمة المرور لحسابك لدى NIVRAN."
    : "We received a request to reset your password for your NIVRAN account.";
  const ignore = isAr
    ? "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة."
    : "If you didn’t request this, you can safely ignore this email.";

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:18px;line-height:1.6;color:#1B1B1B">
    <div style="letter-spacing:0.22em;font-weight:700;font-size:18px;margin-bottom:8px">NIVRAN</div>
    <p style="margin:0 0 14px 0">${intro}</p>
    <p style="margin:0 0 16px 0">
      <a href="${resetUrl}" style="display:inline-block;background:#1B1B1B;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px">
        ${btn}
      </a>
    </p>
    <p style="margin:0 0 8px 0;font-size:13px;color:#444">${ignore}</p>
    <p style="margin:0;font-size:12px;color:#666">
      ${isAr ? "إذا لم يعمل الزر، انسخ الرابط التالي:" : "If the button doesn’t work, copy this link:"}<br/>
      <span style="word-break:break-all">${resetUrl}</span>
    </p>
  </div>`.trim();

  // If credentials are missing, fail silently upstream (routes check envs in prod).
  await resend.emails.send({
    from: safeFrom(),
    to,
    subject,
    html,
  });
}
