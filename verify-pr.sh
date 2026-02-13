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
echo "== Remotes =="
git remote -v
git remote get-url "$REMOTE" >/dev/null
echo "✅ remote '$REMOTE' exists"

echo
echo "== Working tree =="
if [[ -z "$(git status --porcelain)" ]]; then
  echo "✅ clean"
else
  echo "⚠️ dirty"
  git status --short
fi

echo
echo "== Fetch =="
git fetch "$REMOTE" --prune
echo "✅ fetched $REMOTE"

echo
echo "== Branch checks =="
git show-ref --verify --quiet "refs/remotes/${REMOTE}/${PR_BRANCH}"
echo "✅ ${REMOTE}/${PR_BRANCH} exists"

if git merge-base --is-ancestor "$EXPECTED_COMMIT" "${REMOTE}/${PR_BRANCH}"; then
  echo "✅ commit $EXPECTED_COMMIT is in ${REMOTE}/${PR_BRANCH}"
else
  echo "❌ commit $EXPECTED_COMMIT not found in ${REMOTE}/${PR_BRANCH}"
fi

if git show-ref --verify --quiet "refs/remotes/${REMOTE}/${BASE_BRANCH}"; then
  if git merge-base --is-ancestor "$EXPECTED_COMMIT" "${REMOTE}/${BASE_BRANCH}"; then
    echo "✅ commit is merged into ${REMOTE}/${BASE_BRANCH}"
  else
    echo "ℹ️ commit not merged into ${REMOTE}/${BASE_BRANCH} yet"
  fi
fi
