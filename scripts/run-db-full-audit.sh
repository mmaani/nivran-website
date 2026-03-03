#!/usr/bin/env bash
set -euo pipefail

# Runs the full DB audit SQL from anywhere inside the repo.
# Requires: DATABASE_URL_UNPOOLED set to the target database URL.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AUDIT_SQL="${REPO_ROOT}/db_full_audit.sql"
OUT_DIR="${REPO_ROOT}/audit_outputs"
OUT_FILE="${OUT_DIR}/db_full_audit_output.txt"

if [[ ! -f "${AUDIT_SQL}" ]]; then
  echo "ERROR: Missing audit SQL file at ${AUDIT_SQL}" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL_UNPOOLED:-}" ]]; then
  echo "ERROR: DATABASE_URL_UNPOOLED is not set." >&2
  echo "Set it to your PREVIEW DB URL before running this script." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

echo "Running audit using ${AUDIT_SQL} ..."
psql "${DATABASE_URL_UNPOOLED}" -v ON_ERROR_STOP=1 -f "${AUDIT_SQL}" | tee "${OUT_FILE}"
echo "Audit output written to ${OUT_FILE}"
