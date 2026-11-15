#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# shot.sh — capture a screenshot of a prototype screen.
#
# The Playwright browser session does not survive between shell invocations in
# this environment, so every capture must open → resize → screenshot inside a
# single call. This script does that, and reports console errors.
#
#   usage: tooling/shot.sh <path> <out.png> [width] [height] [--full]
#
#   tooling/shot.sh apps/prototype/index.html /tmp/shots/landing.png 1440 900
#   tooling/shot.sh apps/prototype/index.html /tmp/shots/landing.png 1440 900 --full
#   tooling/shot.sh apps/prototype/apply.html  /tmp/shots/apply.png  390 844
# ---------------------------------------------------------------------------
set -uo pipefail

PORT="${PORT:-8902}"
PATH="/c/Users/owida/.workbuddy-ai/binaries/node/versions/22.22.2-6:$PATH"
export PATH

TARGET="${1:?path required}"
OUT="${2:?output file required}"
W="${3:-1440}"
H="${4:-900}"
FULL="${5:-}"

URL="http://127.0.0.1:${PORT}/${TARGET#/}"
mkdir -p "$(dirname "$OUT")"

playwright-cli open "$URL" >/dev/null 2>&1
playwright-cli resize "$W" "$H" >/dev/null 2>&1

if [ "$FULL" = "--full" ]; then
  playwright-cli screenshot --filename "$OUT" --full-page >/dev/null 2>&1
else
  playwright-cli screenshot --filename "$OUT" >/dev/null 2>&1
fi

# Console errors, if any
playwright-cli console 2>/dev/null | tail -12

playwright-cli close >/dev/null 2>&1

if [ -f "$OUT" ]; then
  echo "OK $OUT ($(stat -c%s "$OUT") bytes)"
else
  echo "FAILED to capture $OUT"
  exit 1
fi
