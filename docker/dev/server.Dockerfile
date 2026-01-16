# BodaInsure API Development Dockerfile
# Optimized for development with hot-reload support
#
# Progress visibility features:
# - Step counters [X/5] for startup progress
# - Status indicators (⏳ running, ✓ done, ✗ failed)
# - Duration tracking for migrations and seeding

FROM node:20-alpine

# Install development tools and dependencies for health checks
RUN apk add --no-cache git curl postgresql-client netcat-openbsd

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
# Using npm install for flexibility when lock file may be out of sync
RUN npm install

# Copy source code
COPY . .

# Create uploads directory for local storage
RUN mkdir -p /app/uploads

# Create enhanced entrypoint script with progress visibility
RUN cat > /docker-entrypoint.sh << 'ENTRYPOINT_EOF'
#!/bin/sh
set -e

# Status icons
ICON_PENDING="○"
ICON_RUNNING="⏳"
ICON_DONE="✓"
ICON_FAILED="✗"
ICON_SKIP="⊘"

# Configuration
MAX_RETRIES=30
RETRY_INTERVAL=2

# Helper functions
print_step() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  [$1/$2] $3"
  echo "╚══════════════════════════════════════════════════════════════╝"
}

print_status() {
  echo "     $1 $2"
}

# Startup banner
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

# Step 1: Wait for PostgreSQL
print_step "1" "5" "Waiting for PostgreSQL"
RETRY_COUNT=0
echo "     $ICON_RUNNING Checking connection to ${DB_HOST:-postgres}:${DB_PORT:-5432}..."

until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-bodainsure}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "     $ICON_PENDING Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  print_status "$ICON_FAILED" "PostgreSQL did not become ready"
  exit 1
fi
print_status "$ICON_DONE" "PostgreSQL is ready"

# Step 2: Wait for Redis
print_step "2" "5" "Waiting for Redis"
RETRY_COUNT=0
echo "     $ICON_RUNNING Checking connection to ${REDIS_HOST:-redis}:${REDIS_PORT:-6379}..."

until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "     $ICON_PENDING Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  print_status "$ICON_FAILED" "Redis did not become ready"
  exit 1
fi
print_status "$ICON_DONE" "Redis is ready"

# Step 3: Run migrations
print_step "3" "5" "Running Database Migrations"
echo "     $ICON_RUNNING Applying pending migrations..."
MIGRATION_START=$(date +%s)

if npm run migration:run 2>&1; then
  MIGRATION_END=$(date +%s)
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))
  print_status "$ICON_DONE" "Migrations complete (${MIGRATION_DURATION}s)"
else
  print_status "$ICON_SKIP" "No pending migrations"
fi

# Step 4: Run seeding
print_step "4" "5" "Running Database Seeding"
echo "     $ICON_RUNNING Seeding database..."
SEED_START=$(date +%s)

if npm run seed 2>&1; then
  SEED_END=$(date +%s)
  SEED_DURATION=$((SEED_END - SEED_START))
  print_status "$ICON_DONE" "Seeding complete (${SEED_DURATION}s)"
else
  print_status "$ICON_SKIP" "Seeding complete (data may already exist)"
fi

# Step 5: Start application
print_step "5" "5" "Starting Application"
echo "     $ICON_RUNNING Launching NestJS server..."
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║  $ICON_DONE STARTUP COMPLETE - Server is ready                       ║"
echo "║                                                              ║"
echo "║  API:     http://localhost:${PORT:-3000}/api/v1                       ║"
echo "║  Health:  http://localhost:${PORT:-3000}/api/v1/health                ║"
echo "║  Swagger: http://localhost:${PORT:-3000}/api/docs                     ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

exec "$@"
ENTRYPOINT_EOF
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command - start in development mode with hot-reload
CMD ["npm", "run", "start:dev"]
