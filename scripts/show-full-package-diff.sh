#!/usr/bin/env bash
set -euo pipefail

# Show the complete "full package" file set across a commit range,
# useful when a PR UI only shows the latest incremental commit.

BASE_COMMIT="${BASE_COMMIT:-72d66ca}"
HEAD_COMMIT="${HEAD_COMMIT:-HEAD}"

echo "Comparing: ${BASE_COMMIT}..${HEAD_COMMIT}"

echo
echo "== Commits in range =="
git log --oneline --reverse "${BASE_COMMIT}..${HEAD_COMMIT}"

echo
echo "== Files changed in full package =="
git diff --name-status "${BASE_COMMIT}..${HEAD_COMMIT}"

echo
echo "== Quick filter (admin/store/paytabs) =="
git diff --name-only "${BASE_COMMIT}..${HEAD_COMMIT}" | rg '^(src/app/admin/|src/app/\(store\)/|src/app/api/paytabs/|src/app/api/admin/|src/lib/|src/middleware.ts|README.md|scripts/)'
