#!/usr/bin/env bash
set -euo pipefail

BASE="origin/main"
TARGET_REMOTE="origin/work"
TARGET_LOCAL="work"

ts="$(date +%Y%m%d_%H%M%S)"
backup="backup/work-before-recovery-${ts}"

echo "==> Fetching..."
git fetch origin --prune

echo "==> Checking working tree clean..."
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree not clean. Commit/stash first."
  exit 1
fi

echo "==> Divergence (origin/main...origin/work):"
git rev-list --left-right --count "${BASE}...${TARGET_REMOTE}" || true

echo
echo "==> DRY RUN plan:"
echo "1) Create backup branch on origin: ${backup} -> ${TARGET_REMOTE}"
echo "2) Reset local ${TARGET_LOCAL} to ${BASE}"
echo "3) Push rewritten ${TARGET_LOCAL} to origin with --force-with-lease"
echo
echo "To APPLY, run: APPLY=1 $0"
echo

if [ "${APPLY:-0}" != "1" ]; then
  exit 0
fi

echo "==> APPLY mode: creating backup branch ${backup}..."
# Create a remote backup ref pointing at the current origin/work
git branch -f "${backup}" "${TARGET_REMOTE}"
git push origin "refs/heads/${backup}:refs/heads/${backup}"

echo "==> Checking out ${TARGET_LOCAL} (create if needed)..."
if git show-ref --verify --quiet "refs/heads/${TARGET_LOCAL}"; then
  git checkout "${TARGET_LOCAL}"
else
  git checkout -b "${TARGET_LOCAL}" "${TARGET_REMOTE}"
fi

echo "==> Resetting ${TARGET_LOCAL} to ${BASE}..."
git reset --hard "${BASE}"

echo "==> Pushing ${TARGET_LOCAL} -> origin/${TARGET_LOCAL} with --force-with-lease..."
git push --force-with-lease origin "${TARGET_LOCAL}"

echo
echo "==> After divergence:"
git fetch origin --prune
git rev-list --left-right --count "${BASE}...${TARGET_REMOTE}" || true

echo
echo "==> Undo instructions (if needed):"
echo "git fetch origin --prune"
echo "git checkout ${TARGET_LOCAL}"
echo "git reset --hard origin/${backup}"
echo "git push --force-with-lease origin ${TARGET_LOCAL}"
