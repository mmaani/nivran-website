#!/usr/bin/env bash
set -euo pipefail

printf '\n==> README checklist: contract + quality gates\n'

pnpm check:readme-runbook-contract
pnpm ci:guard
pnpm lint
pnpm build

printf '\n✅ README checklist completed successfully.\n'
