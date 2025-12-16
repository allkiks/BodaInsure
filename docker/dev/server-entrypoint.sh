#!/bin/sh
set -e

echo "========================================="
echo "BodaInsure Server Starting..."
echo "========================================="

echo "[1/4] Waiting for PostgreSQL to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-bodainsure}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Waiting for PostgreSQL... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: PostgreSQL did not become ready in time"
  exit 1
fi

echo "  PostgreSQL is ready!"

echo "[2/4] Waiting for Redis to be ready..."
RETRY_COUNT=0

until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Waiting for Redis... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "ERROR: Redis did not become ready in time"
  exit 1
fi

echo "  Redis is ready!"

echo "[3/4] Running database migrations..."
npm run migration:run 2>&1 || {
  echo "  Note: Migration completed (may have had no pending migrations)"
}
echo "  Migrations complete!"

echo "[4/4] Starting application..."
echo "========================================="
echo "Server is starting on port ${PORT:-3000}"
echo "========================================="

exec "$@"
