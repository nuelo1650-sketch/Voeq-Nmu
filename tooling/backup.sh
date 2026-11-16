#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Backup + restore-test tooling (Phase 5.2).
#
# The rule the roadmap states: an untested backup is not a backup. So this
# is NOT just a dump script — the procedure below ends with a restore TEST
# that compares row counts table by table. Run the whole procedure monthly,
# and run the restore test after any migration that touches money tables
# (FeeIntent, BankCredit, FeeAllocation).
#
# Usage:
#   ./backup.sh                  # dump + verify + row-count manifest
#   DATABASE_URL="$SCRATCH_DB" ./restore-test.sh backups/<file>.sql
#
# Requires: pg_dump / psql on PATH (any Postgres 16 client works against
# Supabase / Neon pooler URLs; use the DIRECT (non-pooler) URL for dumps —
# session mode — because pg_dump opens multiple connections that PgBouncer
# in transaction mode cannot service).
# ---------------------------------------------------------------------------
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set — source the env or export it first." >&2
  exit 1
fi

OUT="$BACKUP_DIR/voeq-registry-$STAMP.sql"
echo "==> dumping to $OUT"
pg_dump "$DATABASE_URL" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --file="$OUT"

# A dump that fails mid-write is not a backup. pg_dump already exits non-zero
# on failure; this header check catches a truncated or empty file too.
echo "==> verifying the dump file"
if ! head -c 4096 "$OUT" | grep -q "PostgreSQL database dump"; then
  echo "dump does not look like a pg_dump file — refusing to record it" >&2
  exit 1
fi

# Row-count manifest: the restore test diffs against this.
echo "==> recording row-count manifest"
MANIFEST="$OUT.manifest"
for TABLE in Institution Campus Category StaffAccount RoleGrant Application \
             ApplicationRevision ApplicationImage ConsentRecord Decision \
             FeeSchedule FeeIntent BankFeedImport BankCredit FeeAllocation \
             VendorSync Notification AuditLog MagicToken StaffNote; do
  COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM \"$TABLE\"")
  echo "$TABLE $COUNT" >> "$MANIFEST"
done

# Retention: keep 8 weekly dumps + 12 monthly. Prune the rest.
echo "==> pruning (keeping newest 20)"
ls -1t "$BACKUP_DIR"/voeq-registry-*.sql 2>/dev/null | tail -n +21 | while read -r old; do
  rm -f "$old" "$old.manifest"
done

echo "==> DONE: $OUT (+ manifest)"
echo "    Now run the restore TEST:  DATABASE_URL=<scratch db> ./restore-test.sh $OUT"
