import "server-only";
import { db } from "@/lib/db";

const cache = new Map<string, boolean>();

function key(table: string, column: string): string {
  return `${table.toLowerCase()}.${column.toLowerCase()}`;
}

export async function hasColumn(table: string, column: string): Promise<boolean> {
  const k = key(table, column);
  if (cache.has(k)) return cache.get(k) === true;

  const r = await db.query<{ ok: boolean }>(
    `select exists (
       select 1
         from information_schema.columns
        where table_schema='public'
          and table_name=$1
          and column_name=$2
     ) as ok`,
    [table, column]
  );

  const ok = !!r.rows[0]?.ok;
  cache.set(k, ok);
  return ok;
}

export async function hasAllColumns(table: string, columns: string[]): Promise<boolean> {
  const checks = await Promise.all(columns.map((column) => hasColumn(table, column)));
  return checks.every(Boolean);
}

