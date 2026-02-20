#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REQUIRED = [
  {
    file: "src/lib/shipping.ts",
    checks: [
      "DEFAULT_FREE_SHIPPING_THRESHOLD_JOD = 69",
      "DEFAULT_BASE_SHIPPING_JOD = 3.5",
    ],
  },
  {
    file: "src/lib/catalog.ts",
    checks: [
      "values ('free_shipping_threshold_jod', 69)",
    ],
  },
  {
    file: "db/migrations/patches/012_free_shipping_default_69.sql",
    checks: [
      "values ('free_shipping_threshold_jod', 69, now())",
      "or store_settings.value_number = 35",
    ],
  },
  {
    file: "src/app/api/shipping-config/route.ts",
    checks: [
      "DEFAULT_FREE_SHIPPING_THRESHOLD_JOD",
      "normalizeFreeShippingThreshold",
    ],
  },
  {
    file: "src/app/api/orders/route.ts",
    checks: [
      "normalizeFreeShippingThreshold",
      "shippingForSubtotal",
    ],
  },
  {
    file: "src/app/admin/catalog/page.tsx",
    checks: [
      "DEFAULT_FREE_SHIPPING_THRESHOLD_JOD",
    ],
  },
  {
    file: "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
    checks: [
      "useState(69)",
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
  console.error("Shipping default contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shipping default contract checks passed.");
