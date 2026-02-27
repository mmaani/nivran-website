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

function getReplyTo(): string | undefined {
  const rt = process.env.EMAIL_REPLY_TO;
  const v = rt ? rt.trim() : "";
  return v.length ? v : undefined;
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
          <div style="margin-top:6px;color:#666;font-size:13px;">Luxury fragrance & body care • نيفران</div>
        </div>
        <div style="padding:20px;">
          ${inner}
        </div>
        <div style="padding:16px 20px;border-top:1px solid rgba(0,0,0,.06);color:#666;font-size:12px;line-height:1.6;">
          ${
            locale === "ar"
              ? "إذا وصل البريد إلى الرسائل غير الهامة/Spam، اختر «ليس بريدًا غير هام» أو انقله إلى صندوق الوارد لضمان وصول تحديثات الطلبات."
              : "If this email lands in Junk/Spam, mark it as “Not junk/Not spam” and move it to your Inbox so you don’t miss order updates."
          }
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
  return new Promise((r) => setTimeout(r, ms));
}

function errToString(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function sendWithRetry(args: {
  kind: "verify_code" | "password_reset" | "sales_welcome" | "order_thank_you";
  to: string;
  subject: string;
  html: string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const resend = getResendClient();
  const from = getEmailFrom();
  const replyTo = getReplyTo();

  if (!resend || !from) {
    console.warn("[email] missing RESEND_API_KEY or EMAIL_FROM; skipping send to", args.to, "subject:", args.subject);
    await logEmailSendAttempt({
      provider: "resend",
      kind: args.kind,
      to: args.to,
      subject: args.subject,
      ok: false,
      attempt: 0,
      error: "MISSING_RESEND_OR_FROM",
      meta: args.meta ?? null,
    });
    return;
  }

  const maxAttempts = 3;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await resend.emails.send({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        replyTo, // ✅ correct Resend SDK property
      });

      const providerId = typeof resp?.data?.id === "string" ? resp.data.id : null;

      await logEmailSendAttempt({
        provider: "resend",
        kind: args.kind,
        to: args.to,
        subject: args.subject,
        ok: true,
        attempt,
        provider_id: providerId,
        meta: args.meta ?? null,
      });

      return;
    } catch (e: unknown) {
      lastErr = e;

      await logEmailSendAttempt({
        provider: "resend",
        kind: args.kind,
        to: args.to,
        subject: args.subject,
        ok: false,
        attempt,
        error: errToString(e),
        meta: args.meta ?? null,
      });

      if (attempt < maxAttempts) {
        await sleep(300 * Math.pow(3, attempt - 1)); // 300ms, 900ms, 2700ms
      }
    }
  }

  console.warn("[email] failed after retries:", args.to, args.subject, errToString(lastErr));
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

  await sendWithRetry({
    kind: "password_reset",
    to,
    subject,
    html: wrapEmailHtml(locale, inner),
  });
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
      ${locale === "ar" ? "إذا لم تحاول إنشاء حساب، تجاهل هذه الرسالة." : "If you didn’t try to create an account, ignore this email."}
    </p>
  `;

  await sendWithRetry({
    kind: "verify_code",
    to,
    subject,
    html: wrapEmailHtml(locale, inner),
  });
}


export async function sendOrderThankYouEmail(args: {
  to: string;
  customerName: string;
  items: Array<{ nameEn: string; nameAr?: string | null; qty: number; totalJod: number }>;
  totalJod: number;
  accountUrl?: string;
  temporaryPassword?: string | null;
  returningCustomer?: boolean;
  cartId?: string | null;
}): Promise<void> {
  const accountUrl = args.accountUrl || "https://www.nivran.com/en/account";
  const safeName = escapeHtml(args.customerName || "there");
  const safePassword = args.temporaryPassword ? escapeHtml(args.temporaryPassword) : "";
  const rows = args.items
    .map((item) => {
      const nameEn = escapeHtml(item.nameEn || "Item");
      const nameAr = escapeHtml(item.nameAr || "");
      const qty = Math.max(1, Math.trunc(Number(item.qty || 1)));
      const total = Number(item.totalJod || 0).toFixed(2);
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid rgba(0,0,0,.07);font-weight:700;color:#1b1b1b;">${nameEn}</td>
        <td style="padding:10px 8px;border-bottom:1px solid rgba(0,0,0,.07);color:#6f6a62;">${nameAr || "—"}</td>
        <td style="padding:10px 8px;border-bottom:1px solid rgba(0,0,0,.07);text-align:center;">${qty}</td>
        <td style="padding:10px 8px;border-bottom:1px solid rgba(0,0,0,.07);text-align:right;font-weight:700;">${total} JOD</td>
      </tr>`;
    })
    .join("\n");

  const loyaltyEn = args.returningCustomer
    ? "Thank you for coming back and for your loyalty to NIVRAN."
    : "Thank you for visiting NIVRAN. We’re delighted to serve you.";
  const loyaltyAr = args.returningCustomer
    ? "شكرًا لعودتك وولائك لنيفران."
    : "شكرًا لزيارتك نيفران، سعداء بخدمتك.";

  const passwordBlock = safePassword
    ? `<div style="margin:14px 0;padding:14px;border-radius:12px;border:1px solid rgba(169,130,62,.35);background:#fffaf0;">
      <div style="font-weight:800;color:#1b1b1b;margin-bottom:6px;">Your temporary password</div>
      <div style="font-size:20px;font-weight:900;letter-spacing:.08em;color:#1b1b1b;">${safePassword}</div>
      <div style="margin-top:8px;font-size:12px;color:#6f6a62;">For your security, please change this password after your first login.</div>
    </div>`
    : "";

  const passwordAr = safePassword
    ? `<p style="margin:0 0 12px;color:#1B1B1B;line-height:1.9;">كلمة المرور المؤقتة الخاصة بك: <strong>${safePassword}</strong></p>
       <p style="margin:0 0 12px;color:#6f6a62;line-height:1.9;">يرجى تغيير كلمة المرور بعد أول تسجيل دخول حفاظًا على أمان حسابك.</p>`
    : "";

  const html = wrapEmailHtml(
    "en",
    `
    <p style="margin:0 0 10px;color:#1B1B1B;line-height:1.75;">Dear ${safeName},</p>
    <p style="margin:0 0 12px;color:#1B1B1B;line-height:1.75;">${loyaltyEn}</p>
    ${passwordBlock}
    <div style="margin:14px 0;">
      <a href="${escapeHtml(accountUrl)}" style="display:inline-block;background:#1B1B1B;color:#fff;text-decoration:none;padding:12px 16px;border-radius:12px;font-weight:700;">
        Open My Account
      </a>
    </div>
    <div style="margin:16px 0 8px;font-weight:800;color:#1b1b1b;">Items purchased</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid rgba(0,0,0,.08);border-radius:12px;overflow:hidden;">
      <thead>
        <tr style="background:#f8f3ea;">
          <th style="padding:10px 8px;text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6f6a62;">Item (EN)</th>
          <th style="padding:10px 8px;text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6f6a62;">Item (AR)</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6f6a62;">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6f6a62;">Line total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:900;">Total</td>
          <td style="padding:12px 8px;text-align:right;font-weight:900;">${Number(args.totalJod || 0).toFixed(2)} JOD</td>
        </tr>
      </tfoot>
    </table>

    <hr style="border:none;border-top:1px solid rgba(0,0,0,.08);margin:18px 0;" />

    <div dir="rtl" style="text-align:right;">
      <p style="margin:0 0 10px;color:#1B1B1B;line-height:1.9;">عميلنا العزيز ${safeName}،</p>
      <p style="margin:0 0 12px;color:#1B1B1B;line-height:1.9;">${loyaltyAr}</p>
      ${passwordAr}
      <p style="margin:0;color:#6f6a62;line-height:1.9;">رابط الحساب: <a href="${escapeHtml(accountUrl)}">${escapeHtml(accountUrl)}</a></p>
    </div>
  `
  );

  await sendWithRetry({
    kind: args.temporaryPassword ? "sales_welcome" : "order_thank_you",
    to: args.to,
    subject: args.returningCustomer
      ? "Thank you for your loyalty to NIVRAN / شكرًا لولائك لنيفران"
      : "Thank you for your order — NIVRAN / شكرًا لطلبك من نيفران",
    html,
    meta: args.cartId ? { cartId: args.cartId } : null,
  });
}

export async function sendSalesWelcomeEmail(args: {
  to: string;
  customerName: string;
  temporaryPassword: string;
  items: Array<{ nameEn: string; nameAr?: string | null; qty: number; totalJod: number }>;
  totalJod: number;
  accountUrl?: string;
}): Promise<void> {
  await sendOrderThankYouEmail({
    to: args.to,
    customerName: args.customerName,
    temporaryPassword: args.temporaryPassword,
    items: args.items,
    totalJod: args.totalJod,
    accountUrl: args.accountUrl,
    returningCustomer: false,
  });
}
