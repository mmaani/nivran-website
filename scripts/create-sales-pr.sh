#!/usr/bin/env bash
set -euo pipefail

git checkout main
git pull origin main
git checkout -B sales-portal-rbac
git add .
git commit -m "Add sales portal with RBAC, session handling, APIs, and audit logs" || true
git push -u origin sales-portal-rbac

gh pr create \
  --base main \
  --head sales-portal-rbac \
  --title "Add sales portal with RBAC, session handling, APIs, and audit logs" \
  --body "Automated PR for sales portal implementation." || true

echo "Done. If PR was not created, branch has no diff vs main."
