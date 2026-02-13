import { Pool, QueryResult, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __nivranPool: Pool | undefined;
}

function getPool(): Pool {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("Missing DATABASE_URL");

  if (!global.__nivranPool) {
    global.__nivranPool = new Pool({
      connectionString: cs,
      ssl: cs.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__nivranPool;
}

export const db = {
  query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return getPool().query<T>(text, params);
  },
};
