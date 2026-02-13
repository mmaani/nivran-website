#!/usr/bin/env bash
set -euo pipefail

PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-}"
LOCALE="${LOCALE:-en}"
CART_ID="${CART_ID:-}"

if [[ -z "$PREVIEW_DOMAIN" ]]; then
  echo "❌ PREVIEW_DOMAIN required (real domain, not placeholder)"
  exit 1
fi

BASE_URL="https://${PREVIEW_DOMAIN}"

json_get () {
  local KEY="$1"
  node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));console.log(d['$KEY'] ?? '')"
}

echo "== Target =="
echo "$BASE_URL"

echo "== 1) Initiate validation check =="
CODE=$(curl -sS -o /tmp/init_bad.json -w "%{http_code}" \
  -X POST "$BASE_URL/api/paytabs/initiate" \
  -H "content-type: application/json" \
  -d '{}')
echo "HTTP: $CODE"
cat /tmp/init_bad.json; echo

if [[ -z "$CART_ID" ]]; then
  echo "== 2) Create order =="
  CREATE=$(curl -sS -X POST "$BASE_URL/api/orders" \
    -H "content-type: application/json" \
    -d "{\"mode\":\"PAYTABS\",\"locale\":\"$LOCALE\",\"qty\":1,\"customer\":{\"name\":\"Preview Test\",\"phone\":\"0790000000\"},\"shipping\":{\"city\":\"Amman\",\"address\":\"Street 1\"}}")
  echo "$CREATE" > /tmp/create.json
  echo "$CREATE"
  OK=$(echo "$CREATE" | json_get ok | tr '[:upper:]' '[:lower:]')
  if [[ "$OK" != "true" ]]; then
    echo "❌ create order failed"
    exit 1
  fi
  CART_ID=$(echo "$CREATE" | json_get cartId)
fi

echo "== 3) Initiate PayTabs =="
INIT=$(curl -sS -X POST "$BASE_URL/api/paytabs/initiate" \
  -H "content-type: application/json" \
  -d "{\"cartId\":\"$CART_ID\",\"locale\":\"$LOCALE\"}")
echo "$INIT" > /tmp/init_ok.json
echo "$INIT"

echo "== 4) Query reconciliation =="
curl -sS "$BASE_URL/api/paytabs/query?cartId=$CART_ID"; echo

echo "== Done =="
echo "Now complete payment in browser via redirectUrl from initiate response."
echo "Then rerun query and verify Neon rows."
