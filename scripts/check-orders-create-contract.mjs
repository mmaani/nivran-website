#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REQUIRED = [
  {
    file: "src/app/api/orders/route.ts",
    checks: [
      "export async function POST(req: Request)",
      "MISSING_REQUIRED_FIELDS",
      "INVALID_PRODUCT:",
      "INVALID_VARIANT",
      "evaluatePromoCodeForLinesLib",
      "evaluateAutoPromotionForLines",
      "readFreeShippingThresholdJodLive",
      "shippingForSubtotalLive",
      "insert into orders",
      "return Response.json({ ok: true, cartId, status });",
    ],
  },
  {
    file: "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
    checks: [
      "const res = await fetch(\"/api/orders\"",
      "throw new Error(`Order create failed (${res.status})`)",
      "const cid = isObject(data) ? toStr(data.cartId).trim() : \"\";",
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
  console.error("Orders create contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Orders create contract checks passed.");
