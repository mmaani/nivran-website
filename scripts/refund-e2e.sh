#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# --- Load env (.env.local preferred) ---
if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
elif [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
else
  echo "ERROR: No .env.local or .env found at repo root."
  exit 1
fi

# --- Required env vars ---
: "${BASE_URL:?Missing BASE_URL in .env.local/.env (example: http://localhost:3000)}"
: "${DATABASE_URL:?Missing DATABASE_URL in .env.local/.env}"
: "${ADMIN_TOKEN:?Missing ADMIN_TOKEN in .env.local/.env}"

# Optional knobs
LIMIT="${LIMIT:-50}"
PAYMENT_METHOD_FILTER="${PAYMENT_METHOD_FILTER:-COD}"  # COD / CASH / CARD_POS
REFUND_REASON="${REFUND_REASON:-smoke}"
REFUND_AMOUNT_JOD="${REFUND_AMOUNT_JOD:-1.00}"
IDEMPOTENCY_KEY="${IDEMPOTENCY_KEY:-smoke-1}"

echo "==> BASE_URL=$BASE_URL"
echo "==> LIMIT=$LIMIT"
echo "==> PAYMENT_METHOD_FILTER=$PAYMENT_METHOD_FILTER"

echo "==> 1) Lint"
pnpm lint

echo "==> 2) Typecheck"
pnpm typecheck

echo "==> 3) DB connectivity gate (must pass)"
node <<'NODE'
const { Client } = require("pg");

(async () => {
  const url = process.env.DATABASE_URL;
  const u = new URL(url);

  console.log("==> DB host:", u.host);
  console.log("==> DB name:", u.pathname.replace("/",""));

  const c = new Client({
    connectionString: url,
    connectionTimeoutMillis: 8000,
  });

  try {
    await c.connect();
    const r = await c.query("select 1 as ok");
    console.log("==> DB OK:", r.rows[0].ok);
  } catch (e) {
    console.error("==> DB CONNECT FAILED");
    console.error(e);
    process.exitCode = 20;
  } finally {
    try { await c.end(); } catch {}
  }
})();
NODE

echo "==> 4) HTTP gate: admin auth sanity (must pass)"
AUTH_JSON="$(
curl -sS -X POST "$BASE_URL/api/admin/restock/run" \
  -H "content-type: application/json" \
  -H "cookie: ADMIN_TOKEN=$ADMIN_TOKEN" \
  -d "{\"limit\":1}" || true
)"

echo "$AUTH_JSON" | node <<'NODE'
let x = "";
process.stdin.on("data", (d) => (x += d));
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(x || "{}");
    if (j && j.ok === false && String(j.error || "").toLowerCase().includes("unauthorized")) {
      console.error("==> ADMIN AUTH FAILED: check ADMIN_TOKEN in .env.local");
      process.exit(21);
    }
    console.log("==> Admin endpoint reachable (response shown below):");
    console.log(JSON.stringify(j, null, 2));
  } catch {
    console.error("==> Non-JSON response from server. Is pnpm dev running?");
    console.error(x);
    process.exit(22);
  }
});
NODE

echo "==> 5) Pick refundable order (DB query)"
ORDER_ID="$(
node <<'NODE'
const { Client } = require("pg");

(async () => {
  const filter = String(process.env.PAYMENT_METHOD_FILTER || "COD").toUpperCase();
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
  });

  await c.connect();

  const r = await c.query(
    "select id from orders where upper(payment_method)=$1 and upper(status) in ('PAID_COD','PAID') order by updated_at desc limit 1",
    [filter]
  );

  await c.end();

  if (!r.rows.length) {
    console.error("No eligible order found for payment_method=" + filter + " with status PAID/PAID_COD.");
    process.exit(30);
  }

  process.stdout.write(String(r.rows[0].id));
})().catch((e) => {
  console.error(e);
  process.exit(31);
});
NODE
)"

echo "==> Using ORDER_ID=$ORDER_ID"

echo "==> 6) Create manual refund"
CREATE_JSON="$(
curl -sS -X POST "$BASE_URL/api/admin/refund" \
  -H "content-type: application/json" \
  -H "cookie: ADMIN_TOKEN=$ADMIN_TOKEN" \
  -d "{\"orderId\":$ORDER_ID,\"amountJod\":$REFUND_AMOUNT_JOD,\"reason\":\"$REFUND_REASON\",\"mode\":\"MANUAL\",\"idempotencyKey\":\"$IDEMPOTENCY_KEY\"}"
)"

REFUND_ID="$(
printf '%s' "$CREATE_JSON" | node <<'NODE'
let x = "";
process.stdin.on("data", (d) => (x += d));
process.stdin.on("end", () => {
  const j = JSON.parse(x || "{}");
  if (!j.ok) {
    console.error("Create refund failed:", j.error || j);
    process.exit(40);
  }
  const id = Number(j.refundId || 0);
  if (!(id > 0)) {
    console.error("refundId missing:", j);
    process.exit(41);
  }
  process.stdout.write(String(id));
});
NODE
)"

echo "==> refundId=$REFUND_ID"

echo "==> 7) Confirm manual refund"
CONFIRM_JSON="$(
curl -sS -X POST "$BASE_URL/api/admin/refund/confirm" \
  -H "content-type: application/json" \
  -H "cookie: ADMIN_TOKEN=$ADMIN_TOKEN" \
  -d "{\"refundId\":$REFUND_ID,\"note\":\"cash returned\"}"
)"

printf '%s' "$CONFIRM_JSON" | node <<'NODE'
let x = "";
process.stdin.on("data", (d) => (x += d));
process.stdin.on("end", () => {
  const j = JSON.parse(x || "{}");
  if (!j.ok) {
    console.error("Confirm refund failed:", j.error || j);
    process.exit(50);
  }
  console.log("==> refund confirmed");
});
NODE

echo "==> 8) Verify restock job exists"
node <<'NODE'
const { Client } = require("pg");

(async () => {
  const refundId = Number(process.env.REFUND_ID || "0");
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
  });
  await c.connect();

  const r = await c.query(
    "select id, status, run_at, created_at from restock_jobs where refund_id=$1 order by id desc limit 5",
    [refundId]
  );

  await c.end();

  if (!r.rows.length) {
    console.error("No restock_jobs found for refund_id=" + refundId);
    process.exit(60);
  }

  console.log("==> restock_jobs (latest):");
  console.log(JSON.stringify(r.rows, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(61);
});
NODE
REFUND_ID="$REFUND_ID"

echo "==> 9) Force due now + run restock runner"
node <<'NODE'
const { Client } = require("pg");

(async () => {
  const refundId = Number(process.env.REFUND_ID || "0");
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
  });
  await c.connect();

  await c.query(
    "update restock_jobs set run_at=now(), updated_at=now() where refund_id=$1 and status in ('SCHEDULED','FAILED')",
    [refundId]
  );

  await c.end();
  console.log("==> forced run_at=now()");
})().catch((e) => {
  console.error(e);
  process.exit(70);
});
NODE
REFUND_ID="$REFUND_ID"

RUN_JSON="$(
curl -sS -X POST "$BASE_URL/api/admin/restock/run" \
  -H "content-type: application/json" \
  -H "cookie: ADMIN_TOKEN=$ADMIN_TOKEN" \
  -d "{\"limit\":$LIMIT}"
)"

printf '%s' "$RUN_JSON" | node <<'NODE'
let x = "";
process.stdin.on("data", (d) => (x += d));
process.stdin.on("end", () => {
  const j = JSON.parse(x || "{}");
  if (!j.ok) {
    console.error("restock/run failed:", j.error || j);
    process.exit(80);
  }
  console.log("==> restock/run ok:");
  console.log(JSON.stringify(j, null, 2));
});
NODE

echo "✅ DONE"
echo "   ORDER_ID=$ORDER_ID"
echo "   REFUND_ID=$REFUND_ID"