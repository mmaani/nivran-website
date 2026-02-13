#!/usr/bin/env bash
set -euo pipefail

PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-}"
LOCALE="${LOCALE:-en}"
CART_ID="${CART_ID:-}"

if [[ -z "$PREVIEW_DOMAIN" ]]; then
  echo "❌ PREVIEW_DOMAIN is required."
  echo "Example: PREVIEW_DOMAIN=nivran-website-git-main-mmaani.vercel.app ./scripts/verify-preview-paytabs.sh"
  exit 1
fi

if [[ "$PREVIEW_DOMAIN" == https://* ]]; then
  PREVIEW_DOMAIN="${PREVIEW_DOMAIN#https://}"
fi

BASE_URL="https://${PREVIEW_DOMAIN}"

json_get () {
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

print_non_json_hint () {
  local body_file="$1"
  if grep -q 'DEPLOYMENT_NOT_FOUND' "$body_file"; then
    echo "❌ Vercel says DEPLOYMENT_NOT_FOUND for ${BASE_URL}"
    echo "   Use the exact preview hostname from Vercel Deployments or PR checks."
    echo "   Then re-run with PREVIEW_DOMAIN=<that-hostname>."
    return 0
  fi
  return 1
}

echo "== Target =="
echo "${BASE_URL}"


echo "== 1) Initiate validation check (expect 400) =="
CODE=$(curl -sS -o /tmp/init_bad.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/paytabs/initiate" \
  -H "content-type: application/json" \
  -d '{}')

echo "HTTP: $CODE"
cat /tmp/init_bad.json; echo

if [[ "$CODE" == "404" ]]; then
  if print_non_json_hint /tmp/init_bad.json; then
    exit 1
  fi
fi

if [[ -z "$CART_ID" ]]; then
  echo "== 2) Create order =="
  CREATE_CODE=$(curl -sS -o /tmp/create.json -w "%{http_code}" \
    -X POST "$BASE_URL/api/orders" \
    -H "content-type: application/json" \
    -d "{\"mode\":\"PAYTABS\",\"locale\":\"$LOCALE\",\"qty\":1,\"customer\":{\"name\":\"Preview Test\",\"phone\":\"0790000000\"},\"shipping\":{\"city\":\"Amman\",\"address\":\"Street 1\"}}")

  echo "HTTP: $CREATE_CODE"
  cat /tmp/create.json; echo

  if [[ "$CREATE_CODE" -lt 200 || "$CREATE_CODE" -ge 300 ]]; then
    print_non_json_hint /tmp/create.json || true
    echo "❌ Failed to create order."
    exit 1
  fi

  OK=$(cat /tmp/create.json | json_get ok | tr '[:upper:]' '[:lower:]')
  CART_ID=$(cat /tmp/create.json | json_get cartId)

  if [[ "$OK" != "true" || -z "$CART_ID" ]]; then
    echo "❌ Unexpected order response (ok/cartId missing)."
    exit 1
  fi

  echo "✅ Created cartId: $CART_ID"
else
  echo "== 2) Using provided CART_ID =="
  echo "CART_ID=$CART_ID"
fi


echo "== 3) Initiate PayTabs =="
INIT_CODE=$(curl -sS -o /tmp/init_ok.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/paytabs/initiate" \
  -H "content-type: application/json" \
  -d "{\"cartId\":\"$CART_ID\",\"locale\":\"$LOCALE\"}")

echo "HTTP: $INIT_CODE"
cat /tmp/init_ok.json; echo

if [[ "$INIT_CODE" -lt 200 || "$INIT_CODE" -ge 300 ]]; then
  print_non_json_hint /tmp/init_ok.json || true
  echo "❌ Failed to initiate PayTabs."
  exit 1
fi

REDIRECT_URL=$(cat /tmp/init_ok.json | json_get redirectUrl)
TRAN_REF=$(cat /tmp/init_ok.json | json_get tranRef)

if [[ -n "$REDIRECT_URL" ]]; then
  echo "✅ redirectUrl: $REDIRECT_URL"
else
  echo "⚠️ redirectUrl missing in initiate response"
fi

if [[ -n "$TRAN_REF" ]]; then
  echo "✅ tranRef: $TRAN_REF"
fi


echo "== 4) Query reconciliation by cartId =="
QUERY_CODE=$(curl -sS -o /tmp/query.json -w "%{http_code}" \
  "$BASE_URL/api/paytabs/query?cartId=$CART_ID")

echo "HTTP: $QUERY_CODE"
cat /tmp/query.json; echo

if [[ "$QUERY_CODE" -lt 200 || "$QUERY_CODE" -ge 300 ]]; then
  print_non_json_hint /tmp/query.json || true
  echo "⚠️ Query endpoint returned non-2xx"
fi


echo "== Next manual step =="
echo "1) Open redirectUrl in browser and complete payment in PayTabs test gateway."
echo "2) Re-run: curl -sS \"$BASE_URL/api/paytabs/query?cartId=$CART_ID\""
echo "3) Verify Neon rows using scripts/neon-verify.sql"
