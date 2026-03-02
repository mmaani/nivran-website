#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assertMatch(content, pattern, message) {
  if (!pattern.test(content)) {
    throw new Error(message);
  }
}

const adminLogin = read("src/app/api/admin/login/route.ts");
assertMatch(adminLogin, /rateLimitCheck\(/, "admin login must be rate limited");
assertMatch(adminLogin, /timingSafeEqual/, "admin login token check must use timing-safe comparison");

const salesLogin = read("src/app/api/admin/sales/login/route.ts");
assertMatch(salesLogin, /res\.cookies\.set\("admin_token"/, "sales login must clear admin_token cookie");
assertMatch(salesLogin, /res\.cookies\.set\("nivran_admin_token"/, "sales login must clear nivran_admin_token cookie");

const inventoryReconcile = read("src/app/api/admin/inventory/reconcile/route.ts");
assertMatch(inventoryReconcile, /admin_inventory_reconcile_runs/, "inventory reconcile must persist idempotency runs");
assertMatch(inventoryReconcile, /x-idempotency-key/, "inventory reconcile must read idempotency key header");

const catalogProducts = read("src/app/api/admin/catalog/products/route.ts");
assertMatch(catalogProducts, /logAdminAudit\(/, "catalog products route must write admin audit logs");
assertMatch(catalogProducts, /invalid-compare-price/, "catalog products route must validate compare price");

const catalogVariants = read("src/app/api/admin/catalog/variants/route.ts");
assertMatch(catalogVariants, /logAdminAudit\(/, "catalog variants route must write admin audit logs");
assertMatch(catalogVariants, /invalid-compare-price/, "catalog variants route must validate compare price");

const productImages = read("src/app/api/admin/catalog/product-images/route.ts");
assertMatch(productImages, /MAX_IMAGE_BYTES/, "product images route must enforce max image size");
assertMatch(productImages, /startsWith\("image\/"\)/, "product images route must enforce image MIME type");

console.log("Admin catalog/inventory hardening contract checks passed.");
