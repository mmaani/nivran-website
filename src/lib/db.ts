import "server-only";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

function normalizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    const useLibpqCompat = url.searchParams.get("uselibpqcompat") === "true";

    // pg v8 warns when sslmode=require because upcoming semantics will weaken TLS checks.
    // Keep secure current behavior by upgrading to verify-full unless explicit libpq compatibility is requested.
    if (!useLibpqCompat && sslmode === "require") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    // Keep original if parsing fails.
  }
  return connectionString;
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



export function isDbConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const nodeError = error as Error & { code?: unknown; errno?: unknown };
  const code = typeof nodeError.code === "string" ? nodeError.code.toUpperCase() : "";
  const errno = typeof nodeError.errno === "string" ? nodeError.errno.toUpperCase() : "";
  const message = String(error.message || "").toUpperCase();

  const connectivityCodes = new Set([
    "ENETUNREACH",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "EAI_AGAIN",
    "EPIPE",
  ]);

  if (connectivityCodes.has(code) || connectivityCodes.has(errno)) return true;

  return (
    message.includes("ENETUNREACH")
    || message.includes("ECONNREFUSED")
    || message.includes("CONNECTION TERMINATED")
    || message.includes("TIMED OUT")
    || message.includes("NO PG_HBA.CONF ENTRY")
    || message.includes("COULD NOT CONNECT TO SERVER")
  );
}

export const db: DbExecutor & {
  withTransaction: <T>(fn: (trx: DbExecutor) => Promise<T>) => Promise<T>;
} = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    const values = params ? [...params] : undefined;
    return getPool().query<T>(text, values);
  },
  withTransaction: async <T>(fn: (trx: DbExecutor) => Promise<T>): Promise<T> => {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const result = await fn(toExecutor(client));
      await client.query("commit");
      return result;
    } catch (error: unknown) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  },
};
