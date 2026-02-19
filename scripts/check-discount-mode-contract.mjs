#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks = [
  {
    file: "src/app/api/orders/route.ts",
    patterns: [
      'discountSource === "CODE" && !promoCode',
      'discountSource !== "CODE" && promoCode',
      'evaluatePromoCodeForLines',
    ],
    forbidden: ['evaluateAutomaticPromotionForLines'],
  },
  {
    file: "src/app/api/promotions/validate/route.ts",
    patterns: [
      'mode === "CODE" && !promoCode',
      'mode === "AUTO" && promoCode',
      'mode !== "CODE"',
      'reason: "DISCOUNT_MODE_UNSUPPORTED"',
    ],
  },
  {
    file: "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
    patterns: [
      'discountMode === "CODE" ? selectedPromo?.code || undefined : undefined',
      'const PROMO_CODE_STORAGE_KEY = "nivran.checkout.promoCode";',
    ],
  },
];

const failures = [];

for (const check of checks) {
  const source = readFileSync(resolve(process.cwd(), check.file), "utf8");
  for (const pattern of check.patterns || []) {
    if (!source.includes(pattern)) {
      failures.push(`${check.file} missing pattern: ${pattern}`);
    }
  }

  for (const pattern of check.forbidden || []) {
    if (source.includes(pattern)) {
      failures.push(`${check.file} contains forbidden pattern: ${pattern}`);
    }
  }

  if (check.file.endsWith("CheckoutClient.tsx")) {
    const matches = source.match(/const\s+PROMO_CODE_STORAGE_KEY\s*=\s*"nivran\.checkout\.promoCode";/g) || [];
    if (matches.length !== 1) {
      failures.push(`${check.file} must declare PROMO_CODE_STORAGE_KEY exactly once, found: ${matches.length}`);
    }
  }
}

if (failures.length) {
  console.error("Discount-mode contract check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Discount-mode contract checks passed.");
