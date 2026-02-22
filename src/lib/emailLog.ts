import { db } from "@/lib/db";

export type EmailLogAttemptInput = {
  provider?: string;
  template?: string;
  to: string;
  from?: string | null;
  replyTo?: string | null;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  error?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function ensureEmailLogTables(): Promise<void> {
  await db.query(`
    create table if not exists email_send_log (
      id bigserial primary key,
      provider text,
      template text,
      "to" text not null,
      "from" text,
      reply_to text,
      subject text,
      html text,
      text text,
      error text,
      meta jsonb,
      created_at timestamptz not null default now()
    );
  `);
}

export async function logEmailSendAttempt(input: EmailLogAttemptInput): Promise<void> {
  try {
    await ensureEmailLogTables();
    await db.query(
      `
      insert into email_send_log (provider, template, "to", "from", reply_to, subject, html, text, error, meta)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        input.provider ?? null,
        input.template ?? null,
        input.to,
        input.from ?? null,
        input.replyTo ?? null,
        input.subject ?? null,
        input.html ?? null,
        input.text ?? null,
        input.error ?? null,
        input.meta ?? null,
      ]
    );
  } catch (e) {
    // never break auth flows if logging fails
    console.warn("[emailLog] failed:", e);
  }
}
