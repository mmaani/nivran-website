#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
  "src/app/(store)/[locale]/product/page.tsx",
  "src/app/api/promotions/validate/route.ts",
  "src/app/api/orders/route.ts",
];

const markers = ["<<<<<<<", "=======", ">>>>>>>"];
const failures = [];

for (const file of files) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  for (const marker of markers) {
    if (source.includes(marker)) {
      failures.push(`${file} contains unresolved merge marker: ${marker}`);
    }
  }
}

if (failures.length) {
  console.error("Merge-marker check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("No unresolved merge markers found in critical files.");
