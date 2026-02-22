import { db } from "@/lib/db";

export type EmailLogRow = {
  id: number;
  provider: string;
  kind: string;
  to_email: string;
  subject: string;
  ok: boolean;
  attempt: number;
  provider_id: string | null;
  error: string | null;
  created_at: string;
};

export async function ensureEmailLogTable(): Promise<void> {
  await db.query(`
    create table if not exists email_send_log (
      id bigserial primary key,
      provider text not null,
      kind text not null,
      to_email text not null,
      subject text not null,
      ok boolean not null,
      attempt int not null default 1,
      provider_id text,
      error text,
      created_at timestamptz not null default now()
    );
  `);

  await db.query(`create index if not exists email_send_log_created_at_idx on email_send_log(created_at desc);`);
  await db.query(`create index if not exists email_send_log_to_email_idx on email_send_log(to_email);`);
  await db.query(`create index if not exists email_send_log_kind_idx on email_send_log(kind);`);
}

export async function logEmailSendAttempt(args: {
  provider: string;
  kind: string;
  to: string;
  subject: string;
  ok: boolean;
  attempt: number;
  provider_id?: string | null;
  error?: string | null;
}): Promise<void> {
  try {
    await ensureEmailLogTable();
    await db.query(
      `insert into email_send_log (provider, kind, to_email, subject, ok, attempt, provider_id, error)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        args.provider,
        args.kind,
        args.to,
        args.subject,
        args.ok,
        args.attempt,
        args.provider_id ?? null,
        args.error ?? null,
      ]
    );
  } catch (e: unknown) {
    // Never break auth flows because logging failed.
    console.warn("[emailLog] failed:", e);
  }
}
