import { db } from "@/lib/db";

export type EmailKind = "verify_code" | "password_reset" | "sales_welcome";

export async function ensureEmailLogTables(): Promise<void> {
  await db.query(`
    create table if not exists email_send_logs (
      id bigserial primary key,
      provider text not null default 'resend',
      kind text not null,
      "to" text not null,
      subject text,
      ok boolean not null default false,
      attempt int not null default 0,
      provider_id text,
      error text,
      meta jsonb,
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`create index if not exists email_send_logs_to_idx on email_send_logs("to");`);
  await db.query(`create index if not exists email_send_logs_created_at_idx on email_send_logs(created_at desc);`);
  await db.query(`create index if not exists email_send_logs_kind_idx on email_send_logs(kind);`);
}

export async function logEmailSendAttempt(args: {
  provider?: "resend";
  kind: EmailKind;
  to: string;
  subject?: string | null;
  ok: boolean;
  attempt: number;
  provider_id?: string | null;
  error?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await ensureEmailLogTables();

  await db.query(
    `insert into email_send_logs (provider, kind, "to", subject, ok, attempt, provider_id, error, meta)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      args.provider ?? "resend",
      args.kind,
      args.to,
      args.subject ?? null,
      !!args.ok,
      Number(args.attempt || 0),
      args.provider_id ?? null,
      args.error ?? null,
      args.meta ?? null,
    ]
  );
}
