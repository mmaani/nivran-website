#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REQUIRED = [
  {
    file: "src/app/api/catalog/product-by-slug/route.ts",
    checks: [
      "if (!p || !p.is_active)",
      "{ ok: false, error: \"Not found\" }",
      "status: 404",
    ],
  },
  {
    file: "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
    checks: [
      "if (!r.ok || !isObject(j) || j.ok !== true || !isObject(j.product))",
      "setBuyNowError(COPY.unavailableProduct)",
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
  console.error("Buy-now inactive contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Buy-now inactive contract checks passed.");
