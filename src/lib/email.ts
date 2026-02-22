// src/lib/email.ts
import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const resend = getResend();

  // In dev/build environments where env vars are missing, don't crash builds.
  if (!resend) {
    // Keep this as a warning (not an error) so Next build won't fail.
    console.warn("[email] RESEND_API_KEY missing; skipping email send to:", to);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.warn("[email] EMAIL_FROM missing; skipping email send to:", to);
    return;
  }

  await resend.emails.send({
    from,
    to,
    subject: "Reset your NIVRAN password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2 style="letter-spacing:2px;margin:0 0 12px">NIVRAN</h2>
        <p>You requested to reset your password.</p>
        <p style="margin:18px 0">
          <a href="${resetUrl}"
             style="background:#1B1B1B;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px;display:inline-block">
             Reset Password
          </a>
        </p>
        <p style="color:#555">This link expires soon. If you didn’t request this, ignore this email.</p>
      </div>
    `,
  });
}