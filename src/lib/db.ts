import "server-only";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

function normalizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);

    const sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();
    if (!sslmode) url.searchParams.set("sslmode", "require");

    if (!url.searchParams.get("uselibpqcompat")) {
      url.searchParams.set("uselibpqcompat", "true");
    }

    if ((url.searchParams.get("sslrootcert") || "").toLowerCase() === "system") {
      url.searchParams.delete("sslrootcert");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}

function sslConfigFromUrl(connectionString: string): false | { rejectUnauthorized: boolean } {
  try {
    const url = new URL(connectionString);
    const sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();

    // Neon expects SSL. "verify-full" is strict. "require" is common.
    // In Node pg, verify-full essentially maps to rejectUnauthorized=true (it verifies cert chain).
    // If your environment has issues verifying CA, you may temporarily set rejectUnauthorized=false,
    // but we will NOT default to that.
    if (sslmode === "disable") return false;

    // Require SSL, verify chain by default
    return { rejectUnauthorized: true };
  } catch {
    return { rejectUnauthorized: true };
  }
}

function getPool(): Pool {
  if (pool) return pool;

  const rawConnectionString = process.env.DATABASE_URL;
  if (!rawConnectionString) throw new Error("DATABASE_URL env var is required");

  const connectionString = normalizeDatabaseUrl(rawConnectionString);
  const ssl = sslConfigFromUrl(connectionString);

  pool = new Pool({
    connectionString,
    ssl,

    // Codespaces/network can stall; avoid infinite hangs
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    max: 10,
    allowExitOnIdle: true,
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
  if (code === "ENETUNREACH") return true;
  if (code === "ENOTFOUND") return true;

  if (code === "57P01") return true;
  if (code === "57P02") return true;
  if (code === "57P03") return true;

  if (msg.includes("terminating connection")) return true;
  if (msg.includes("no pg_hba.conf entry")) return true;
  if (msg.includes("self signed certificate")) return true;
  if (msg.includes("certificate has expired")) return true;
  if (msg.includes("unable to verify the first certificate")) return true;

  return false;
}

export function isDbSchemaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const nodeError = error as Error & { code?: unknown };
  const code = typeof nodeError.code === "string" ? nodeError.code.toUpperCase() : "";
  return code === "42P01" || code === "42703" || code === "42883" || code === "42P07";
}