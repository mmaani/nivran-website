#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const auditDir = path.join(repoRoot, "audit_outputs");

const dbTablesPath = path.join(auditDir, "db_tables.txt");
const dbSizesPath = path.join(auditDir, "db_table_sizes.txt");
const dbFksPath = path.join(auditDir, "db_fks.txt");
const codeHitsPath = path.join(auditDir, "code_sql_hits_merged.txt");
const fullAuditPath = path.join(auditDir, "db_full_audit_output.txt");

const required = [dbTablesPath, dbSizesPath, dbFksPath, codeHitsPath, fullAuditPath];
for (const filePath of required) {
  try {
    readFileSync(filePath, "utf8");
  } catch {
    console.error(`Missing required input: ${filePath}`);
    process.exit(1);
  }
}

const dbTablesRaw = readFileSync(dbTablesPath, "utf8");
const dbSizesRaw = readFileSync(dbSizesPath, "utf8");
const dbFksRaw = readFileSync(dbFksPath, "utf8");
const codeHitsRaw = readFileSync(codeHitsPath, "utf8").toLowerCase();
const fullAuditRaw = readFileSync(fullAuditPath, "utf8");

const tableSet = new Set();
for (const line of dbTablesRaw.split("\n")) {
  const match = line.match(/^\s*public\s*\|\s*([a-z0-9_]+)\s*\|\s*table\b/i);
  if (match) tableSet.add(match[1]);
}

if (tableSet.size === 0) {
  console.error("No tables parsed from audit_outputs/db_tables.txt");
  process.exit(1);
}

const rowCounts = new Map();
let inRowsSection = false;
for (const line of fullAuditRaw.split("\n")) {
  if (!inRowsSection && line.includes("table_name") && line.includes("rows_estimated") && line.includes("rows_exact")) {
    inRowsSection = true;
    continue;
  }
  if (inRowsSection) {
    if (/^\(\d+ rows\)$/.test(line.trim())) break;
    const match = line.match(/^\s*([a-z0-9_]+)\s*\|\s*-?\d+\s*\|\s*(\d+)\s*$/i);
    if (match) rowCounts.set(match[1], Number(match[2]));
  }
}

const sizes = new Map();
for (const line of dbSizesRaw.split("\n")) {
  const match = line.match(/^\s*([a-z0-9_]+)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*$/i);
  if (match && match[1] !== "table_name") {
    sizes.set(match[1], { bytes: Number(match[2]), pretty: match[3] });
  }
}

const adjacency = new Map();
const fkPresence = new Set();
const fkLines = [];
for (const line of dbFksRaw.split("\n")) {
  const match = line.match(/^\s*[^|]+\|\s*([a-z0-9_]+)\s*\|\s*([a-z0-9_]+)\s*\|/i);
  if (!match) continue;
  const from = match[1];
  const to = match[2];
  fkLines.push([from, to]);
  fkPresence.add(from);
  fkPresence.add(to);
  if (!adjacency.has(from)) adjacency.set(from, new Set());
  if (!adjacency.has(to)) adjacency.set(to, new Set());
  adjacency.get(from).add(to);
  adjacency.get(to).add(from);
}

const runtimeCore = new Set([
  "admin_audit_logs",
  "auth_rate_limits",
  "carts",
  "categories",
  "contact_submissions",
  "customer_cart_items",
  "customer_carts",
  "customer_email_verification_codes",
  "customer_password_reset_tokens",
  "customer_sessions",
  "customers",
  "email_send_logs",
  "inventory",
  "order_items",
  "orders",
  "password_reset_tokens",
  "payments",
  "paytabs_callbacks",
  "product_images",
  "product_variants",
  "products",
  "promotions",
  "refunds",
  "restock_jobs",
  "sales_audit_logs",
  "staff_login_attempts",
  "staff_users",
  "store_settings",
  "variants"
]);

function isReferencedInCode(tableName) {
  const pattern = new RegExp(`(^|[^a-z0-9_])${tableName}([^a-z0-9_]|$)`, "i");
  return pattern.test(codeHitsRaw);
}

const directCodeKeep = new Set();
for (const tableName of tableSet) {
  if (isReferencedInCode(tableName) || runtimeCore.has(tableName)) {
    directCodeKeep.add(tableName);
  }
}

const keep = new Set(directCodeKeep);
const queue = [...directCodeKeep];
while (queue.length > 0) {
  const current = queue.shift();
  const neighbors = adjacency.get(current);
  if (!neighbors) continue;
  for (const next of neighbors) {
    if (!keep.has(next)) {
      keep.add(next);
      queue.push(next);
    }
  }
}

const sortedTables = [...tableSet].sort((a, b) => a.localeCompare(b));
const keepList = [];
const archiveCandidates = [];
const dropLater = [];

const csvLines = [
  "table_name,present_in_code,rows_exact,total_bytes,total_size_pretty,has_fk,classification,reason"
];

for (const tableName of sortedTables) {
  const inCode = isReferencedInCode(tableName);
  const rowCount = rowCounts.get(tableName) ?? -1;
  const sizeInfo = sizes.get(tableName) ?? { bytes: 0, pretty: "unknown" };
  const hasFk = fkPresence.has(tableName);

  let classification = "KEEP";
  let reason = "Referenced in code/runtime or connected by FK to kept tables";

  if (!keep.has(tableName)) {
    if (rowCount > 0 || hasFk) {
      classification = "ARCHIVE_CANDIDATE";
      reason = rowCount > 0 ? "Not referenced in code; has rows" : "Not referenced in code; has FK relationships";
      archiveCandidates.push(tableName);
    } else {
      classification = "DROP_LATER";
      reason = "Not referenced in code; 0 rows; no FKs";
      dropLater.push(tableName);
    }
  } else {
    keepList.push(tableName);
  }

  const row = [
    tableName,
    inCode ? "YES" : "NO",
    String(rowCount),
    String(sizeInfo.bytes),
    sizeInfo.pretty,
    hasFk ? "YES" : "NO",
    classification,
    reason
  ];
  csvLines.push(row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
}

writeFileSync(path.join(auditDir, "table_usage_matrix.csv"), `${csvLines.join("\n")}\n`, "utf8");
writeFileSync(path.join(auditDir, "tables_keep.txt"), `${keepList.sort((a, b) => a.localeCompare(b)).join("\n")}\n`, "utf8");
writeFileSync(path.join(auditDir, "tables_archive_candidates.txt"), `${archiveCandidates.sort((a, b) => a.localeCompare(b)).join("\n")}${archiveCandidates.length > 0 ? "\n" : ""}`, "utf8");
writeFileSync(path.join(auditDir, "tables_drop_later.txt"), `${dropLater.sort((a, b) => a.localeCompare(b)).join("\n")}${dropLater.length > 0 ? "\n" : ""}`, "utf8");

const evidence = {
  tables: sortedTables.length,
  keep: keepList.length,
  archiveCandidates: archiveCandidates.length,
  dropLater: dropLater.length,
  fkEdges: fkLines.length
};
writeFileSync(path.join(auditDir, "table_usage_summary.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
