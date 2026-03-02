import "server-only";
import type { DbTx } from "@/lib/db";

export async function ensureAdminAuditLogsTable(trx: DbTx): Promise<void> {
  await trx.query(`
    create table if not exists admin_audit_logs (
      id bigserial primary key,
      admin_id text not null,
      action text not null,
      entity text not null,
      entity_id text,
      metadata jsonb,
      ip_address text,
      created_at timestamptz not null default now()
    );
  `);
}

function readIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first;
  return (req.headers.get("x-real-ip") || "").trim();
}

export async function logAdminAudit(
  trx: DbTx,
  req: Request,
  input: {
    adminId: string;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: unknown;
  }
): Promise<void> {
  await ensureAdminAuditLogsTable(trx);
  await trx.query(
    `insert into admin_audit_logs (admin_id, action, entity, entity_id, metadata, ip_address)
     values ($1, $2, $3, $4, $5::jsonb, $6)`,
    [input.adminId, input.action, input.entity, input.entityId || null, JSON.stringify(input.metadata ?? {}), readIp(req) || null]
  );
}
