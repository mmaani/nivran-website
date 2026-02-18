#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CRITICAL_FILES = [
  // Storefront purchase flow (PLP/PDP/cart/checkout)
  "src/app/(store)/[locale]/cart/CartClient.tsx",
  "src/app/(store)/[locale]/checkout/CheckoutClient.tsx",
  "src/app/(store)/[locale]/product/page.tsx",
  "src/app/(store)/[locale]/product/ProductCatalogClient.tsx",
  "src/app/(store)/[locale]/product/[slug]/page.tsx",
  "src/app/(store)/[locale]/product/[slug]/ProductPurchasePanel.tsx",
  "src/components/AddToCartButton.tsx",

  // Admin UX and auth-sensitive screens
  "src/app/admin/catalog/page.tsx",
  "src/app/admin/customers/page.tsx",
  "src/app/admin/login/LoginClient.tsx",
  "src/app/admin/_components/adminClient.ts",
  "src/app/admin/_components/RequireAdmin.tsx",

  // Critical API surfaces (catalog, variants, orders, promos)
  "src/app/api/admin/catalog/products/route.ts",
  "src/app/api/admin/catalog/variants/route.ts",
  "src/app/api/admin/catalog/promotions/route.ts",
  "src/app/api/admin/customers/export/route.ts",
  "src/app/api/catalog/product/route.ts",
  "src/app/api/catalog/product-by-slug/route.ts",
  "src/app/api/orders/route.ts",
  "src/app/api/promotions/validate/route.ts",
  "src/app/api/health/route.ts",

  // Core pricing/cart/catalog libs
  "src/lib/cartStore.ts",
  "src/lib/cartStore.server.ts",
  "src/lib/catalog.ts",
  "src/lib/orders.ts",
  "src/lib/pricing.ts",
  "src/lib/catalogFallback.ts",
  "src/lib/promotions.ts",
];

function collectTypeAliases(source) {
  const aliases = new Map();
  const lines = source.split(/\r?\n/);
  const typeRegex = /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(typeRegex);
    if (!match) continue;
    const name = match[1];
    const list = aliases.get(name) ?? [];
    list.push(index + 1);
    aliases.set(name, list);
  }

  return aliases;
}

const issues = [];

for (const relativeFile of CRITICAL_FILES) {
  const absoluteFile = resolve(process.cwd(), relativeFile);
  const source = readFileSync(absoluteFile, "utf8");
  const aliases = collectTypeAliases(source);

  for (const [name, lines] of aliases.entries()) {
    if (lines.length < 2) continue;
    issues.push({ file: relativeFile, name, lines });
  }
}

if (issues.length > 0) {
  console.error("Duplicate type aliases detected in critical files:\n");
  for (const issue of issues) {
    console.error(`- ${issue.file}: type ${issue.name} at lines ${issue.lines.join(", ")}`);
  }
  process.exit(1);
}

console.log("No duplicate type aliases found in critical files.");
