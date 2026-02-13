import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  if (!global.__pgPool) global.__pgPool = new Pool({ connectionString: url });
  return global.__pgPool;
}
