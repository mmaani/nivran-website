import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __nivranPool: Pool | undefined;
}

function isLocalDb(url: string) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

export function db(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");

  if (!global.__nivranPool) {
    global.__nivranPool = new Pool({
      connectionString: url,
      ssl: isLocalDb(url) ? undefined : { rejectUnauthorized: false },
    });
  }

  return global.__nivranPool;
}
