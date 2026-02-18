#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [
  {
    file: "src/app/api/orders/route.ts",
    patterns: [
      'discountSource === "CODE" && !promoCode',
      'discountSource !== "CODE" && promoCode',
      'evaluateAutomaticPromotionForLines',
      'evaluatePromoCodeForLines',
    ],
  },
  {
    file: "src/app/api/promotions/validate/route.ts",
    patterns: [
      'mode === "CODE" && !promoCode',
      'mode === "AUTO" && promoCode',
    ],
  },
  {
    file: "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
    patterns: [
      'AUTO and CODE cannot be combined',
      'discountMode === "CODE" ? selectedPromo?.code || undefined : undefined',
    ],
  },
];

const failures = [];
for (const check of checks) {
  const source = readFileSync(resolve(process.cwd(), check.file), "utf8");
  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) {
      failures.push(`${check.file} missing pattern: ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error("Discount-mode contract check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Discount-mode contract checks passed.");
