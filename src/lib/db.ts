import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __nivranPool: Pool | undefined;
}

export function db(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!global.__nivranPool) {
    global.__nivranPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  return global.__nivranPool;
}
