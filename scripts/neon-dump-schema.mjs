// scripts/neon-dump-schema.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// -------- .env loader (no dotenv dependency) --------
function parseEnvFile(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();

    // Remove optional export prefix: export KEY=VALUE
    if (key.startsWith("export ")) continue; // ignore weird forms in key

    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    // Unescape common sequences in double-quoted env values
    val = val.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");

    out[key] = val;
  }
  return out;
}

function loadDatabaseUrl() {
  const candidates = [".env.local", ".env"];
  for (const f of candidates) {
    const p = path.join(projectRoot, f);
    if (!fs.existsSync(p)) continue;
    const env = parseEnvFile(fs.readFileSync(p, "utf8"));
    if (env.DATABASE_URL) return { file: f, url: env.DATABASE_URL };
  }
  return { file: null, url: null };
}

// -------- main --------
async function main() {
  const { file, url } = loadDatabaseUrl();
  if (!url) {
    console.error("ERROR: DATABASE_URL not found in .env.local or .env");
    process.exit(1);
  }

  // Do NOT print the URL (keep it private)
  console.log(`Loaded DATABASE_URL from ${file}`);

  const outDir = path.join(projectRoot, "neon_dump");
  fs.mkdirSync(outDir, { recursive: true });

  const pool = new Pool({
    connectionString: url,
    // Neon typically requires SSL; connection string often already has sslmode=require.
    // This keeps it compatible even if sslmode is not set.
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  try {
    const tables = await pool.query(`
      select table_name
      from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
      order by table_name;
    `);

    const columns = await pool.query(`
      select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema='public'
      order by table_name, ordinal_position;
    `);

    const constraints = await pool.query(`
      select
        tc.table_name,
        tc.constraint_type,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
      from information_schema.table_constraints tc
      left join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      left join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.table_schema='public'
      order by tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position nulls last;
    `);

    const indexes = await pool.query(`
      select tablename, indexname, indexdef
      from pg_indexes
      where schemaname='public'
      order by tablename, indexname;
    `);

    const report = {
      generated_at: new Date().toISOString(),
      tables: tables.rows,
      columns: columns.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
    };

    // Write JSON (best for analysis)
    fs.writeFileSync(
      path.join(outDir, "neon_schema_dump.json"),
      JSON.stringify(report, null, 2),
      "utf8"
    );

    // Write readable TXT
    const txt =
      `Neon Schema Dump\nGenerated: ${report.generated_at}\n\n` +
      `===== TABLES =====\n${JSON.stringify(report.tables, null, 2)}\n\n` +
      `===== COLUMNS =====\n${JSON.stringify(report.columns, null, 2)}\n\n` +
      `===== CONSTRAINTS =====\n${JSON.stringify(report.constraints, null, 2)}\n\n` +
      `===== INDEXES =====\n${JSON.stringify(report.indexes, null, 2)}\n`;

    fs.writeFileSync(path.join(outDir, "neon_schema_dump.txt"), txt, "utf8");

    console.log(`Wrote:\n- neon_dump/neon_schema_dump.json\n- neon_dump/neon_schema_dump.txt`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
