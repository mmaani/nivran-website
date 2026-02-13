#!/usr/bin/env bash
set -euo pipefail

PR_BRANCH="${PR_BRANCH:-work}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-29d5795}"
BASE_BRANCH="${BASE_BRANCH:-main}"
REMOTE="${REMOTE:-origin}"

echo "== Repo diagnostics =="
pwd
git rev-parse --is-inside-work-tree >/dev/null
echo "✅ inside git repo"

echo
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "❌ remote '$REMOTE' not found"
  git remote -v || true
  exit 1
fi

echo "== Remotes =="
git remote -v

echo
echo "== Working tree =="
if [[ -z "$(git status --porcelain)" ]]; then
  echo "✅ clean"
else
  echo "⚠️ has local changes"
  git status --short
fi

echo
echo "== Fetch =="
git fetch "$REMOTE" --prune
echo "✅ fetched $REMOTE"

echo
echo "== Verify PR branch =="
if ! git show-ref --verify --quiet "refs/remotes/${REMOTE}/${PR_BRANCH}"; then
  echo "❌ ${REMOTE}/${PR_BRANCH} does not exist"
  exit 1
fi

echo "✅ ${REMOTE}/${PR_BRANCH} exists"

if git merge-base --is-ancestor "$EXPECTED_COMMIT" "${REMOTE}/${PR_BRANCH}"; then
  echo "✅ commit $EXPECTED_COMMIT is in ${REMOTE}/${PR_BRANCH}"
else
  echo "❌ commit $EXPECTED_COMMIT is NOT in ${REMOTE}/${PR_BRANCH}"
fi

if git show-ref --verify --quiet "refs/remotes/${REMOTE}/${BASE_BRANCH}"; then
  if git merge-base --is-ancestor "$EXPECTED_COMMIT" "${REMOTE}/${BASE_BRANCH}"; then
    echo "✅ commit is merged into ${REMOTE}/${BASE_BRANCH}"
  else
    echo "ℹ️ commit not merged into ${REMOTE}/${BASE_BRANCH} yet"
  fi
fi
