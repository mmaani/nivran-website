#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REQUIRED = [
  {
    file: "src/app/(store)/[locale]/product/page.tsx",
    checks: [
      "ensureCatalogTablesSafe",
      "fallbackCatalogRows",
      "fallbackCategories",
      "isRecoverableCatalogSetupError",
      "[catalog] Using fallback product catalog",
    ],
  },
  {
    file: "src/app/(store)/[locale]/product/[slug]/page.tsx",
    checks: [
      "ensureCatalogTablesSafe",
      "isRecoverableCatalogSetupError",
      "renderFallbackPdp",
      "CATALOG_RECOVERABLE_ERROR",
    ],
  },
  {
    file: "src/lib/catalog.ts",
    checks: [
      'code === "42P01"',
      'message.includes("relation") && message.includes("does not exist")',
    ],
  },
];

const failures = [];

for (const entry of REQUIRED) {
  const content = await readFile(entry.file, "utf8");
  for (const needle of entry.checks) {
    if (!content.includes(needle)) {
      failures.push(`${entry.file} missing: ${needle}`);
    }
  }
}

if (failures.length) {
  console.error("Product catalog fallback contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Product catalog fallback contract checks passed.");
