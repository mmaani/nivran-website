#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";

const requiredEnvVars = [
  "DATABASE_URL",
  "ADMIN_TOKEN",
  "PAYTABS_API_BASE_URL",
  "PAYTABS_PROFILE_ID",
  "PAYTABS_SERVER_KEY",
  "PAYTABS_CLIENT_KEY",
  "APP_BASE_URL",
];

const requiredScripts = [
  "scripts/verify-pr.sh",
  "scripts/verify-preview-paytabs.sh",
  "scripts/paytabs-uat.sh",
  "scripts/show-full-package-diff.sh",
  "scripts/recover-work-branch.sh",
  "recover-work-branch.sh",
];

const envExample = await readFile(".env.example", "utf8");
const missingEnv = requiredEnvVars.filter((name) => !new RegExp(`^${name}=`, "m").test(envExample));

const missingScripts = [];
for (const script of requiredScripts) {
  try {
    await access(script);
  } catch {
    missingScripts.push(script);
  }
}

if (missingEnv.length || missingScripts.length) {
  console.error("README runbook contract check failed.\n");
  if (missingEnv.length) {
    console.error("Missing env vars in .env.example:");
    for (const item of missingEnv) console.error(`- ${item}`);
  }
  if (missingScripts.length) {
    console.error("\nMissing runbook scripts:");
    for (const item of missingScripts) console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("README runbook contract checks passed.");
