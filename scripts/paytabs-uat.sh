#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
LOCALE="${LOCALE:-en}"
CART_ID="${CART_ID:-}"
SIMULATE_CALLBACK="${SIMULATE_CALLBACK:-0}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Missing required command: $1"
    exit 1
  }
}

json_get() {
  local KEY="$1"
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync(0, 'utf8');
    try {
      const d = JSON.parse(raw);
      const v = d['$KEY'];
      process.stdout.write(v === undefined || v === null ? '' : String(v));
    } catch {
      process.stdout.write('');
    }
  "
}

status_from_admin() {
  local CART="$1"
  local ADMIN_TOKEN="${ADMIN_TOKEN:-}"
  if [[ -z "$ADMIN_TOKEN" ]]; then
    echo ""
    return 0
  fi

  curl -sS "$BASE_URL/api/admin/orders" \
    -H "x-admin-token: $ADMIN_TOKEN" | node -e '
      const fs=require("fs");
      const cart=process.argv[1];
      try {
        const json=JSON.parse(fs.readFileSync(0,"utf8"));
        if (!json || !Array.isArray(json.orders)) return process.stdout.write("");
        const row=json.orders.find((o)=>String(o.cart_id||"")===cart);
        process.stdout.write(row?.status ? String(row.status) : "");
      } catch {
        process.stdout.write("");
      }
    ' "$CART"
}

require_cmd curl
require_cmd node
require_cmd openssl

BASE_URL="${BASE_URL%/}"

echo "== PayTabs UAT =="
echo "BASE_URL=$BASE_URL"
echo "LOCALE=$LOCALE"
echo "SIMULATE_CALLBACK=$SIMULATE_CALLBACK"

if [[ -z "$CART_ID" ]]; then
  echo "\n== 1) Create order (card flow) =="
  CREATE_CODE=$(curl -sS -o /tmp/uat-create.json -w "%{http_code}" \
    -X POST "$BASE_URL/api/orders" \
    -H "content-type: application/json" \
    -d "{\"mode\":\"PAYTABS\",\"locale\":\"$LOCALE\",\"qty\":1,\"customer\":{\"name\":\"UAT Tester\",\"phone\":\"0790000000\"},\"shipping\":{\"city\":\"Amman\",\"address\":\"UAT Street 1\"}}")
  echo "HTTP: $CREATE_CODE"
  cat /tmp/uat-create.json; echo

  if [[ "$CREATE_CODE" -lt 200 || "$CREATE_CODE" -ge 300 ]]; then
    echo "❌ create order failed"
    exit 1
  fi

  CART_ID=$(cat /tmp/uat-create.json | json_get cartId)
  if [[ -z "$CART_ID" ]]; then
    echo "❌ cartId missing in order response"
    exit 1
  fi
  echo "✅ cartId=$CART_ID"
else
  echo "\n== 1) Using provided CART_ID =="
  echo "✅ cartId=$CART_ID"
fi

echo "\n== 2) Initiate PayTabs (redirect) =="
INIT_CODE=$(curl -sS -o /tmp/uat-init.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/paytabs/initiate" \
  -H "content-type: application/json" \
  -d "{\"cartId\":\"$CART_ID\",\"locale\":\"$LOCALE\"}")
echo "HTTP: $INIT_CODE"
cat /tmp/uat-init.json; echo

if [[ "$INIT_CODE" -lt 200 || "$INIT_CODE" -ge 300 ]]; then
  echo "❌ paytabs initiate failed"
  exit 1
fi

REDIRECT_URL=$(cat /tmp/uat-init.json | json_get redirectUrl)
TRAN_REF=$(cat /tmp/uat-init.json | json_get tranRef)

if [[ -n "$REDIRECT_URL" ]]; then
  echo "✅ redirectUrl=$REDIRECT_URL"
else
  echo "⚠️ redirectUrl missing"
fi

if [[ -n "$TRAN_REF" ]]; then
  echo "✅ tranRef=$TRAN_REF"
fi

echo "\n== 3) Callback and status transition =="
if [[ "$SIMULATE_CALLBACK" == "1" ]]; then
  if [[ -z "${PAYTABS_SERVER_KEY:-}" ]]; then
    echo "❌ SIMULATE_CALLBACK=1 requires PAYTABS_SERVER_KEY"
    exit 1
  fi

  RAW_PAYLOAD=$(node -e '
    const p={
      cart_id: process.argv[1],
      tran_ref: process.argv[2] || "SIM-TRAN-REF",
      payment_result:{response_status:"A", response_message:"Authorised"},
      message:"Authorised"
    };
    process.stdout.write(JSON.stringify(p));
  ' "$CART_ID" "$TRAN_REF")

  SIG=$(printf '%s' "$RAW_PAYLOAD" | openssl dgst -sha256 -hmac "$PAYTABS_SERVER_KEY" | sed 's/^.* //')

  CALLBACK_CODE=$(curl -sS -o /tmp/uat-callback.json -w "%{http_code}" \
    -X POST "$BASE_URL/api/paytabs/callback" \
    -H "content-type: application/json" \
    -H "x-paytabs-signature: $SIG" \
    --data "$RAW_PAYLOAD")

  echo "HTTP: $CALLBACK_CODE"
  cat /tmp/uat-callback.json; echo

  if [[ "$CALLBACK_CODE" -lt 200 || "$CALLBACK_CODE" -ge 300 ]]; then
    echo "❌ callback failed"
    exit 1
  fi
  echo "✅ callback accepted"
else
  echo "Manual required:"
  echo "1) Open redirectUrl and complete payment in PayTabs sandbox."
  echo "2) Wait for PayTabs server callback to /api/paytabs/callback."
fi

echo "\n== 4) Query reconciliation =="
QUERY_CODE=$(curl -sS -o /tmp/uat-query.json -w "%{http_code}" \
  "$BASE_URL/api/paytabs/query?cartId=$CART_ID")
echo "HTTP: $QUERY_CODE"
cat /tmp/uat-query.json; echo

if [[ "$QUERY_CODE" -lt 200 || "$QUERY_CODE" -ge 300 ]]; then
  echo "⚠️ query returned non-2xx"
fi

echo "\n== 5) Confirm status in admin =="
ADMIN_STATUS="$(status_from_admin "$CART_ID")"
if [[ -n "$ADMIN_STATUS" ]]; then
  echo "✅ admin status for $CART_ID => $ADMIN_STATUS"
else
  echo "⚠️ Could not read admin status (set ADMIN_TOKEN for API check)."
fi

echo "\nDone."
echo "cartId=$CART_ID"
