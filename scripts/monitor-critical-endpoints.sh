#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
LOCALE="${LOCALE:-en}"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl -sS -o /tmp/monitor_body.txt -w '%{http_code}' "${BASE_URL}${path}" || true)"
  if [[ "$code" != "$expected" ]]; then
    echo "[$TS] FAIL ${path} expected=${expected} got=${code}"
    echo "--- body ---"
    cat /tmp/monitor_body.txt || true
    echo
    return 1
  fi
  echo "[$TS] OK   ${path} status=${code}"
  return 0
}

failures=0
check "/api/health" "200" || failures=$((failures+1))
check "/api/catalog/product-by-slug?slug=nivran-calm-100ml" "200" || failures=$((failures+1))
check "/${LOCALE}/checkout" "200" || failures=$((failures+1))

if [[ $failures -gt 0 ]]; then
  echo "[$TS] monitor-critical-endpoints: ${failures} failed checks"
  exit 1
fi

echo "[$TS] monitor-critical-endpoints: all checks passed"
