#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# The RESTORE TEST (Phase 5.2) — the part most shops skip and the only part
# that makes a backup real. Restores a dump into a SCRATCH database and
# diffs row counts against the manifest recorded by backup.sh.
#
# Usage:
#   DATABASE_URL="postgresql://.../scratch_db" ./restore-test.sh backups/voeq-registry-XXXX.sql
#
# The scratch database must be EMPTY and disposable — restore --clean drops
# tables by name. Never point this at production. Ever.
# ---------------------------------------------------------------------------
set -euo pipefail

DUMP="$1"
MANIFEST="$DUMP.manifest"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL (the SCRATCH database) is not set." >&2
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "dump not found: $DUMP" >&2
  exit 1
fi
if [ ! -f "$MANIFEST" ]; then
  echo "manifest not found: $MANIFEST — run backup.sh first" >&2
  exit 1
fi

echo "==> restoring into the scratch database (this wipes its tables)"
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$DUMP"

echo "==> diffing row counts"
FAIL=0
while read -r TABLE EXPECTED; do
  ACTUAL=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM \"$TABLE\"")
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    echo "  ok      $TABLE $ACTUAL"
  else
    echo "  MISMATCH $TABLE expected $EXPECTED, restored $ACTUAL" >&2
    FAIL=1
  fi
done < "$MANIFEST"

# The money tables get a content check, not just a count: the audit chain
# must still verify (recompute would need app code, so here: no gaps in ids
# is NOT the test — presence of every FeeAllocation with its credit+intent
# is).
echo "==> money-table referential sanity"
BROKEN=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT COUNT(*) FROM \"FeeAllocation\" a LEFT JOIN \"BankCredit\" c ON c.id = a.\"creditId\" LEFT JOIN \"FeeIntent\" i ON i.id = a.\"intentId\" WHERE c.id IS NULL OR i.id IS NULL")
if [ "$BROKEN" != "0" ]; then
  echo "  MISMATCH $BROKEN FeeAllocation rows lost their credit or intent" >&2
  FAIL=1
else
  echo "  ok      every FeeAllocation joins to its credit and intent"
fi

if [ "$FAIL" != "0" ]; then
  echo "RESTORE TEST FAILED — investigate before trusting these backups" >&2
  exit 1
fi
echo "RESTORE TEST PASSED — this backup is a real backup."
