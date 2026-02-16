#!/usr/bin/env bash
set -euo pipefail

# Target explicit TS "any" usage (not SQL "= any(...)" inside strings).
rg -n --type ts --type tsx \
  -e ':\s*any\b' \
  -e '\bas any\b' \
  -e 'catch\s*\(\s*\w+\s*:\s*any\b' \
  -e 'useRef\s*<\s*any\b' \
  -e 'useState\s*<\s*any\b' \
  -e 'Record<[^>]*,\s*any\s*>' \
  -e 'Map<[^>]*,\s*any\s*>' \
  src
