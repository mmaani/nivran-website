#!/usr/bin/env bash
set -euo pipefail

# Recover `work` when it diverges massively from `main` due to bad merges/conflicts.
# Dry-run by default. Set APPLY=1 to execute.

APPLY="${APPLY:-0}"
REMOTE="${REMOTE:-origin}"
SOURCE_MAIN="${SOURCE_MAIN:-main}"
TARGET_WORK="${TARGET_WORK:-work}"

run() {
  echo "+ $*"
  if [[ "$APPLY" == "1" ]]; then
    eval "$@"
  fi
}

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Run this script inside a git repository." >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "ERROR: Remote '$REMOTE' is not configured." >&2
  echo "Add it first, e.g. git remote add $REMOTE <repo-url>" >&2
  exit 1
fi

if ! git ls-remote --exit-code --heads "$REMOTE" "$SOURCE_MAIN" >/dev/null 2>&1; then
  echo "ERROR: Branch '$SOURCE_MAIN' does not exist on '$REMOTE'." >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/heads/$TARGET_WORK"; then
  echo "ERROR: Local branch '$TARGET_WORK' does not exist." >&2
  exit 1
fi

echo "== Branch recovery plan =="
echo "Remote: $REMOTE"
echo "Source main: $SOURCE_MAIN"
echo "Target work: $TARGET_WORK"
echo "Mode: $([[ "$APPLY" == "1" ]] && echo APPLY || echo DRY-RUN)"
echo

run "git fetch $REMOTE"
run "git checkout $TARGET_WORK"
run "git branch backup/$TARGET_WORK-\$(date +%Y%m%d-%H%M%S)"
run "git reset --hard $REMOTE/$SOURCE_MAIN"
run "git push $REMOTE $TARGET_WORK --force-with-lease"

echo
if [[ "$APPLY" == "1" ]]; then
  echo "Recovery complete. '$TARGET_WORK' now matches '$REMOTE/$SOURCE_MAIN'."
else
  echo "Dry-run complete. Re-run with APPLY=1 to execute."
fi
