import fs from "node:fs/promises";
import { Client } from "pg";

const outFile = "neon_audit_report.txt";

const queries = [
  {
    title: "TABLES_EXISTENCE",
    sql: `
      select table_name
      from information_schema.tables
      where table_schema='public'
        and table_name in (
          'orders','paytabs_callbacks','customers','customer_sessions','password_reset_tokens','staff_users'
        )
      order by table_name;
    `,
  },
  {
    title: "COLUMNS_AUDIT",
    sql: `
      select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema='public'
        and table_name in (
          'orders','paytabs_callbacks','customers','customer_sessions','password_reset_tokens','staff_users'
        )
      order by table_name, ordinal_position;
    `,
  },
  {
    title: "ORDERS_SANITY",
    sql: `
      select
        count(*) as total_orders,
        count(*) filter (where cart_id is null or cart_id='') as bad_cart_id,
        count(*) filter (where amount is null) as null_amount,
        count(*) filter (where total_jod is null) as null_total_jod,
        count(*) filter (where currency is null or currency='') as bad_currency,
        count(*) filter (where payment_method is null or payment_method='') as bad_payment_method
      from orders;
    `,
  },
  {
    title: "SESSIONS_SANITY",
    sql: `
      select
        count(*) as total_sessions,
        count(*) filter (where token_hash is null or token_hash='') as bad_token_hash,
        count(*) filter (where expires_at is null) as bad_expires_at,
        count(*) filter (where revoked_at is null and expires_at <= now()) as expired_active_sessions
      from customer_sessions;
    `,
  }
];

function section(title, rows) {
  return `\n\n===== ${title} =====\n${JSON.stringify(rows, null, 2)}\n`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is missing in environment.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  let output = `Neon Audit Report\nGenerated: ${new Date().toISOString()}\n`;

  try {
    await client.connect();
    for (const q of queries) {
      try {
        const res = await client.query(q.sql);
        output += section(q.title, res.rows);
      } catch (err) {
        output += `\n\n===== ${q.title} =====\nERROR: ${String(err)}\n`;
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  await fs.writeFile(outFile, output, "utf8");
  console.log(`Done. Wrote ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
