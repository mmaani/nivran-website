import "server-only";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

function normalizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);

    const sslmode = url.searchParams.get("sslmode");
    if (!sslmode) url.searchParams.set("sslmode", "require");

    const sslmode2 = url.searchParams.get("sslmode");
    if (sslmode2 === "verify-full" && !url.searchParams.get("sslrootcert")) {
      url.searchParams.set("sslrootcert", "system");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

function getPool(): Pool {
  if (pool) return pool;

  const rawConnectionString = process.env.DATABASE_URL;
  if (!rawConnectionString) throw new Error("DATABASE_URL env var is required");

  const connectionString = normalizeDatabaseUrl(rawConnectionString);

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

  return pool;
}

export type DbTx = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

export type DbExecutor = DbTx & {
  withTransaction: <T>(fn: (trx: DbTx) => Promise<T>) => Promise<T>;
};

function toTxExecutor(client: PoolClient): DbTx {
  return {
    query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
      const values = params ? [...params] : undefined;
      return client.query<T>(text, values);
    },
  };
}

export async function withDb<T>(fn: (exec: DbTx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(toTxExecutor(client));
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(fn: (trx: DbTx) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const out = await fn(toTxExecutor(client));
    await client.query("commit");
    return out;
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}

export const db: DbExecutor = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
    const values = params ? [...params] : undefined;
    return getPool().query<T>(text, values);
  },
  withTransaction: <T>(fn: (trx: DbTx) => Promise<T>) => withTransaction(fn),
};

export function isDbConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const nodeError = error as Error & { code?: unknown };
  const code = typeof nodeError.code === "string" ? nodeError.code.toUpperCase() : "";
  const msg = (error.message || "").toLowerCase();

  if (code === "ECONNREFUSED") return true;
  if (code === "ETIMEDOUT") return true;
  if (code === "ENOTFOUND") return true;
  if (code === "57P01") return true;
  if (code === "57P02") return true;
  if (code === "57P03") return true;
  if (msg.includes("terminating connection")) return true;
  if (msg.includes("no pg_hba.conf entry")) return true;

  return false;
}
