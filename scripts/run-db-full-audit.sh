#!/usr/bin/env bash
set -euo pipefail

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
  exit 1
fi

mkdir -p "${OUT_DIR}"

URL="${DATABASE_URL_UNPOOLED}"
case "${URL}" in
  *sslrootcert=*) ;;
  *) URL="${URL}&sslrootcert=system" ;;
esac

psql "${URL}" -v ON_ERROR_STOP=1 -X -f "${AUDIT_SQL}" > "${OUT_FILE}"
