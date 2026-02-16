import "server-only";
import { Pool, QueryResult, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL env var is required");
}

// Neon/Vercel typically requires SSL. This keeps current behavior.
const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

export const db = {
  query: <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> =>
    pool.query(text, params),
};
