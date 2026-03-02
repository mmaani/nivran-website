import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseEnvFile(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadDatabaseUrl() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const p = path.join(projectRoot, file);
    if (!fs.existsSync(p)) continue;
    const env = parseEnvFile(fs.readFileSync(p, "utf8"));
    if (env.DATABASE_URL) return { file, url: env.DATABASE_URL };
  }
  return { file: null, url: null };
}

const REQUIRED_TABLES = [
  "products",
  "categories",
  "promotions",
  "product_images",
  "product_variants",
  "store_settings",
  "orders",
  "paytabs_callbacks",
  "refunds",
  "restock_jobs",
  "customers",
  "customer_sessions",
  "staff_users",
  "staff_login_attempts",
  "admin_audit_logs",
  "contact_submissions",
  "newsletter_subscribers",
  "sales_audit_logs",
];

const REQUIRED_COLUMNS = {
  products: ["id", "slug", "price_jod", "inventory_qty", "category_key", "is_active"],
  product_variants: ["id", "product_id", "label", "price_jod", "is_default", "is_active"],
  promotions: ["id", "promo_kind", "code", "discount_type", "discount_value", "is_active"],
  orders: ["id", "cart_id", "status", "payment_method", "items", "inventory_committed_at"],
  refunds: ["id", "order_id", "method", "status", "restocked", "requested_at"],
  restock_jobs: ["id", "refund_id", "status", "run_at", "attempts"],
  staff_users: ["id", "username", "password_hash", "role", "is_active"],
  paytabs_callbacks: ["id", "cart_id", "tran_ref", "signature_valid"],
};

const QUERY_SMOKE_TESTS = [
  "select id, slug, inventory_qty, is_active from products order by id desc limit 1",
  "select id, product_id, label, price_jod, is_default from product_variants order by id desc limit 1",
  "select id, status, payment_method, inventory_committed_at from orders order by id desc limit 1",
  "select id, order_id, status, method, restocked from refunds order by id desc limit 1",
  "select id, refund_id, status, run_at from restock_jobs order by id desc limit 1",
  "select id, username, role, is_active from staff_users order by id desc limit 1",
  "select key, value_number from store_settings where key='free_shipping_threshold_jod' limit 1",
  "select id, cart_id, tran_ref, signature_valid from paytabs_callbacks order by id desc limit 1",
];

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const { file, url } = loadDatabaseUrl();
  if (!url) {
    console.error("DATABASE_URL was not found in .env.local or .env");
    process.exit(1);
  }

  console.log(`Loaded DATABASE_URL from ${file}`);

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  let failed = false;

  try {
    const tableRes = await pool.query(
      `select table_name
         from information_schema.tables
        where table_schema='public' and table_type='BASE TABLE'`
    );
    const tables = new Set(tableRes.rows.map((r) => String(r.table_name)));

    printSection("Required Tables");
    for (const table of REQUIRED_TABLES) {
      const ok = tables.has(table);
      console.log(`${ok ? "OK" : "MISSING"} table ${table}`);
      if (!ok) failed = true;
    }

    printSection("Required Columns");
    for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
      for (const col of cols) {
        const colRes = await pool.query(
          `select 1
             from information_schema.columns
            where table_schema='public' and table_name=$1 and column_name=$2
            limit 1`,
          [table, col]
        );
        const ok = (colRes.rowCount || 0) > 0;
        console.log(`${ok ? "OK" : "MISSING"} ${table}.${col}`);
        if (!ok) failed = true;
      }
    }

    printSection("Query Smoke Tests");
    for (const sql of QUERY_SMOKE_TESTS) {
      try {
        await pool.query(sql);
        console.log(`OK ${sql}`);
      } catch (error) {
        failed = true;
        const msg = error instanceof Error ? error.message : String(error || "unknown error");
        console.log(`FAILED ${sql} :: ${msg}`);
      }
    }

    printSection("Summary");
    if (failed) {
      console.log("FAILED: schema/query mismatches detected");
      process.exitCode = 1;
    } else {
      console.log("PASS: required Neon admin schema and smoke queries are healthy");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const msg = error instanceof Error ? error.stack || error.message : String(error || "unknown error");
  console.error(`Health check failed: ${msg}`);
  process.exit(1);
});
