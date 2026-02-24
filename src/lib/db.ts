import "server-only";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

function normalizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);

    // Prefer explicit sslmode from env. If missing, default to `require` for Neon.
    const sslmode = url.searchParams.get("sslmode");
    if (!sslmode) url.searchParams.set("sslmode", "require");

    // If verify-full is used, ensure libpq-style clients can find system roots.
    // (This is especially helpful for local psql usage inside containers.)
    const sslmode2 = url.searchParams.get("sslmode");
    if (sslmode2 === "verify-full" && !url.searchParams.get("sslrootcert")) {
      url.searchParams.set("sslrootcert", "system");
    }

    return url.toString();
  } catch {
    // Keep original if parsing fails.
    return connectionString;
  }
}

function getPool(): Pool {
  if (pool) return pool;

  const rawConnectionString = process.env.DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error("DATABASE_URL env var is required");
  }

  const connectionString = normalizeDatabaseUrl(rawConnectionString);

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

  return pool;
}

export type DbExecutor = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

function toExecutor(client: PoolClient): DbExecutor {
  return {
    query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
      const values = params ? [...params] : undefined;
      return client.query<T>(text, values);
    },
  };
}

export const db: DbExecutor = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => {
    const values = params ? [...params] : undefined;
    return getPool().query<T>(text, values);
  },
};

export async function withDb<T>(fn: (exec: DbExecutor) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(toExecutor(client));
  } finally {
    client.release();
  }
}

export function isDbConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const nodeError = error as Error & { code?: unknown; errno?: unknown };
  const code = typeof nodeError.code === "string" ? nodeError.code.toUpperCase() : "";
  const msg = (error.message || "").toLowerCase();

  // Common DB connectivity indicators in serverless/containers
  if (code === "ECONNREFUSED") return true;
  if (code === "ETIMEDOUT") return true;
  if (code === "ENOTFOUND") return true;
  if (code === "57P01") return true; // admin_shutdown
  if (code === "57P02") return true; // crash_shutdown
  if (code === "57P03") return true; // cannot_connect_now
  if (msg.includes("terminating connection")) return true;
  if (msg.includes("no pg_hba.conf entry")) return true;
  if (msg.includes("password authentication failed")) return false;

  return false;
}
