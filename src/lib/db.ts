import { Pool } from "pg";

let _pool: Pool | null = null;

export function db() {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing DATABASE_URL");

  _pool = new Pool({ connectionString });
  return _pool;
}
