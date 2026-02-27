#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const REQUIRED = [
  {
    file: "src/app/(store)/[locale]/account/AccountClient.tsx",
    checks: [
      "const nextCart = mode === \"replace\" ? mappedCartItems : mergeCartSum(currentCart, mappedCartItems);",
      "writeLocalCart(nextCart);",
      "fetch(\"/api/cart/sync\"",
      "sessionStorage.setItem(\"nivran_reorder_payload_v1\"",
      "orderId: String(reorderOrderId)",
      "mode,",
    ],
  },
  {
    file: "src/app/(store)/[locale]/cart/CartClient.tsx",
    checks: [
      "function readReorderPayload(): ReorderPayload | null",
      "fetchReorderPayloadFromOrder",
      "const nextItems = reorderPayload.mode === \"replace\" ? reorderPayload.items : mergeCartSum(current, reorderPayload.items);",
      "sessionStorage.removeItem(REORDER_KEY);",
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
  console.error("Reorder cart contract checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Reorder cart contract checks passed.");
