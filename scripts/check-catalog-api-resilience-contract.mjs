#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REQUIRED = [
  {
    file: "src/app/api/catalog/product/route.ts",
    checks: [
      "ensureCatalogTablesSafe",
      "isRecoverableCatalogSetupError",
      "cache-control\": \"no-store\"",
      "fallback: true",
      "CATALOG_RECOVERABLE_ERROR",
    ],
  },
  {
    file: "src/app/api/catalog/product-by-slug/route.ts",
    checks: [
      "ensureCatalogTablesSafe",
      "isRecoverableCatalogSetupError",
      "cache-control\": \"no-store\"",
      "fallback: true",
      "CATALOG_RECOVERABLE_ERROR",
    ],
  },
  {
    file: "src/app/api/catalog/product-image/[id]/route.ts",
    checks: [
      "ensureCatalogTablesSafe",
      "isRecoverableCatalogSetupError",
      "cache-control\": \"no-store\"",
    ],
  },
  {
    file: "src/app/api/health/route.ts",
    checks: [
      "catalog_recoverable",
      "CATALOG_RECOVERABLE_ERROR",
      "cache-control\": \"no-store\"",
    ],
  },
];

const failures = [];

for (const entry of REQUIRED) {
  const content = await readFile(entry.file, "utf8");
  for (const needle of entry.checks) {
    if (!content.includes(needle)) failures.push(`${entry.file} missing: ${needle}`);
  }
}

if (failures.length) {
  console.error("Catalog API resilience contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Catalog API resilience contract checks passed.");
