#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/scripts/recover-work-branch.sh"

if [[ ! -f "$TARGET" ]]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  cat >&2 <<MSG
ERROR: Missing script: scripts/recover-work-branch.sh

Current branch: ${CURRENT_BRANCH}
Repo root: ${SCRIPT_DIR}

This usually means your current branch does not yet include the recovery helper commit.

Fix steps (from repo root):
  git fetch origin --prune
  git checkout work
  git pull origin work

Then retry:
  ./recover-work-branch.sh

If your default branch is main-only workflow, run recovery from work then merge work -> main.
MSG
  exit 1
fi

exec "$TARGET" "$@"
