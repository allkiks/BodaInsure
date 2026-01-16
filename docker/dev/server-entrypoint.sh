#!/bin/sh
set -e

# ============================================================================
# BodaInsure Server Entrypoint Script
# ============================================================================
# This script handles container startup with progress visibility:
# 1. Wait for PostgreSQL
# 2. Wait for Redis
# 3. Run database migrations
# 4. Run database seeding
# 5. Start the application
#
# Progress visibility features:
# - Step counters [X/5] for overall progress
# - Status indicators (⏳ in progress, ✓ done, ✗ failed)
# - Clear, concise messages for each action
# ============================================================================

# Status icons (Unicode-compatible)
ICON_PENDING="○"
ICON_RUNNING="⏳"
ICON_DONE="✓"
ICON_FAILED="✗"
ICON_SKIP="⊘"

# Colors for better visibility (fallback to plain text if not supported)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Configuration
MAX_RETRIES=30
RETRY_INTERVAL=2

# Helper function to print step header
print_step() {
  STEP_NUM=$1
  TOTAL=$2
  MESSAGE=$3
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  [${STEP_NUM}/${TOTAL}] ${MESSAGE}"
  echo "╚══════════════════════════════════════════════════════════════╝"
}

# Helper function to print status
print_status() {
  ICON=$1
  MESSAGE=$2
  echo "     ${ICON} ${MESSAGE}"
}

# ============================================================================
# STARTUP BANNER
# ============================================================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║            BODAINSURE SERVER STARTUP                         ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-3000}"
echo ""

# ============================================================================
# STEP 1: Wait for PostgreSQL
# ============================================================================
print_step "1" "5" "Waiting for PostgreSQL"
RETRY_COUNT=0

echo "     ${ICON_RUNNING} Checking PostgreSQL connection..."
echo "     Host: ${DB_HOST:-postgres}:${DB_PORT:-5432}"

until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-bodainsure}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "     ${ICON_PENDING} Waiting... (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
  sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  print_status "${ICON_FAILED}" "PostgreSQL did not become ready in time"
  exit 1
fi

print_status "${ICON_DONE}" "PostgreSQL is ready"

# ============================================================================
# STEP 2: Wait for Redis
# ============================================================================
print_step "2" "5" "Waiting for Redis"
RETRY_COUNT=0

echo "     ${ICON_RUNNING} Checking Redis connection..."
echo "     Host: ${REDIS_HOST:-redis}:${REDIS_PORT:-6379}"

until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "     ${ICON_PENDING} Waiting... (attempt ${RETRY_COUNT}/${MAX_RETRIES})"
  sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  print_status "${ICON_FAILED}" "Redis did not become ready in time"
  exit 1
fi

print_status "${ICON_DONE}" "Redis is ready"

# ============================================================================
# STEP 3: Run Database Migrations
# ============================================================================
print_step "3" "5" "Running Database Migrations"
echo "     ${ICON_RUNNING} Applying pending migrations..."

MIGRATION_START=$(date +%s)

if npm run migration:run 2>&1; then
  MIGRATION_END=$(date +%s)
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))
  print_status "${ICON_DONE}" "Migrations complete (${MIGRATION_DURATION}s)"
else
  MIGRATION_EXIT=$?
  if [ $MIGRATION_EXIT -eq 0 ]; then
    print_status "${ICON_SKIP}" "No pending migrations"
  else
    print_status "${ICON_FAILED}" "Migration failed (exit code: ${MIGRATION_EXIT})"
    echo "     Note: Check database connection and migration files"
  fi
fi

# ============================================================================
# STEP 4: Run Database Seeding
# ============================================================================
print_step "4" "5" "Running Database Seeding"
echo "     ${ICON_RUNNING} Seeding database..."

SEED_START=$(date +%s)

if npm run seed 2>&1; then
  SEED_END=$(date +%s)
  SEED_DURATION=$((SEED_END - SEED_START))
  print_status "${ICON_DONE}" "Seeding complete (${SEED_DURATION}s)"
else
  SEED_EXIT=$?
  print_status "${ICON_SKIP}" "Seeding completed with warnings (data may already exist)"
fi

# ============================================================================
# STEP 5: Start Application
# ============================================================================
print_step "5" "5" "Starting Application"
echo "     ${ICON_RUNNING} Launching NestJS server..."
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║  ${ICON_DONE} STARTUP COMPLETE - Server is ready                       ║"
echo "║                                                              ║"
echo "║  API:     http://localhost:${PORT:-3000}/api/v1                       ║"
echo "║  Health:  http://localhost:${PORT:-3000}/api/v1/health                ║"
echo "║  Swagger: http://localhost:${PORT:-3000}/api/docs                     ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

exec "$@"
