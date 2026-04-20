#!/usr/bin/env bash
# setup-mock-db.sh
# Provisions a local Postgres "lifepreneur_dev" database for development.
# Idempotent: safe to re-run. Creates the role/DB if missing, writes .env.local,
# runs Prisma generate + migrate deploy, and seeds mock data.

set -euo pipefail

# ----- config ---------------------------------------------------------------
DB_NAME="${DB_NAME:-lifepreneur_dev}"
DB_USER="${DB_USER:-lifepreneur}"
DB_PASSWORD="${DB_PASSWORD:-lifepreneur}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Older corepack bundled with Node <22.23 can't verify newer pnpm signatures.
# Opt out of integrity checks so `pnpm` / `prisma` don't crash mid-run.
export COREPACK_INTEGRITY_KEYS="${COREPACK_INTEGRITY_KEYS:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔧 DATABASE_URL = $DATABASE_URL"

# ----- helpers --------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

psql_admin() {
  # Run a psql command as a Postgres superuser.
  # On macOS (Homebrew) there is no "postgres" OS user — connect as the current
  # user against the Postgres "postgres" role instead. On Linux the conventional
  # path is `sudo -u postgres psql`.
  if [[ "$(uname)" == "Darwin" ]]; then
    psql -U postgres -v ON_ERROR_STOP=1 "$@"
  elif have sudo; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"
  else
    psql -U postgres -v ON_ERROR_STOP=1 "$@"
  fi
}

# ----- 1. ensure Postgres role + database exist ----------------------------
if ! have psql; then
  echo "❌ psql not found. Install Postgres client tools first (e.g. 'sudo apt install postgresql-client')."
  exit 1
fi

if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "✅ Database reachable as ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
  echo "🛠  Provisioning role '${DB_USER}' and database '${DB_NAME}' via superuser..."
  psql_admin -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

  if ! psql_admin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    psql_admin -d postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  fi

  psql_admin -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
  psql_admin -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

  if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "❌ Still can't connect as ${DB_USER}. Check pg_hba.conf (md5/scram-sha-256 for local connections)."
    exit 1
  fi
  echo "✅ Role + database ready."
fi

# ----- 2. write .env.local --------------------------------------------------
ENV_FILE="${ROOT_DIR}/.env.local"
touch "$ENV_FILE"

upsert_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    # escape for sed
    local escaped
    escaped=$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')
    sed -i.bak -E "s|^${key}=.*|${key}=\"${escaped}\"|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    printf '%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

upsert_env DATABASE_URL "$DATABASE_URL"
upsert_env DIRECT_URL "$DATABASE_URL"
echo "✅ Wrote DATABASE_URL + DIRECT_URL to .env.local"

# ----- 3. Prisma generate + migrate ----------------------------------------
echo "📦 Generating Prisma client..."
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DATABASE_URL" \
  pnpm --filter @repo/database exec prisma generate \
    --no-hints --schema=./prisma/schema.prisma

echo "🚚 Applying migrations..."
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DATABASE_URL" \
  pnpm --filter @repo/database exec prisma migrate deploy \
    --schema=./prisma/schema.prisma

# ----- 4. seed mock data ----------------------------------------------------
echo "🌱 Seeding mock data..."
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DATABASE_URL" \
  pnpm exec tsx scripts/seed-test-users.ts || echo "⚠️  seed-test-users.ts failed (continuing)"
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DATABASE_URL" \
  pnpm exec tsx scripts/seed-beta-features.ts || echo "⚠️  seed-beta-features.ts failed (continuing)"
DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DATABASE_URL" \
  pnpm exec tsx scripts/seed-content-videos.ts || echo "⚠️  seed-content-videos.ts failed (continuing)"

echo "🎉 Mock database ready: ${DATABASE_URL}"
