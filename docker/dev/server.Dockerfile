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
# Using printf to avoid line ending issues on Windows
RUN printf '#!/bin/sh\n\
set -e\n\
\n\
# Status icons\n\
ICON_PENDING="○"\n\
ICON_RUNNING="⏳"\n\
ICON_DONE="✓"\n\
ICON_FAILED="✗"\n\
ICON_SKIP="⊘"\n\
\n\
# Configuration\n\
MAX_RETRIES=30\n\
RETRY_INTERVAL=2\n\
\n\
# Helper functions\n\
print_step() {\n\
  echo ""\n\
  echo "╔══════════════════════════════════════════════════════════════╗"\n\
  echo "║  [$1/$2] $3"\n\
  echo "╚══════════════════════════════════════════════════════════════╝"\n\
}\n\
\n\
print_status() {\n\
  echo "     $1 $2"\n\
}\n\
\n\
# Startup banner\n\
echo ""\n\
echo "╔══════════════════════════════════════════════════════════════╗"\n\
echo "║                                                              ║"\n\
echo "║            BODAINSURE SERVER STARTUP                         ║"\n\
echo "║                                                              ║"\n\
echo "╚══════════════════════════════════════════════════════════════╝"\n\
echo ""\n\
echo "Environment: ${NODE_ENV:-development}"\n\
echo "Port: ${PORT:-3000}"\n\
echo ""\n\
\n\
# Step 1: Wait for PostgreSQL\n\
print_step "1" "5" "Waiting for PostgreSQL"\n\
RETRY_COUNT=0\n\
echo "     $ICON_RUNNING Checking PostgreSQL..."\n\
\n\
until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-bodainsure}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do\n\
  RETRY_COUNT=$((RETRY_COUNT + 1))\n\
  echo "     $ICON_PENDING Waiting... ($RETRY_COUNT/$MAX_RETRIES)"\n\
  sleep $RETRY_INTERVAL\n\
done\n\
\n\
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then\n\
  print_status "$ICON_FAILED" "PostgreSQL not ready"\n\
  exit 1\n\
fi\n\
print_status "$ICON_DONE" "PostgreSQL ready"\n\
\n\
# Step 2: Wait for Redis\n\
print_step "2" "5" "Waiting for Redis"\n\
RETRY_COUNT=0\n\
echo "     $ICON_RUNNING Checking Redis..."\n\
\n\
until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do\n\
  RETRY_COUNT=$((RETRY_COUNT + 1))\n\
  echo "     $ICON_PENDING Waiting... ($RETRY_COUNT/$MAX_RETRIES)"\n\
  sleep $RETRY_INTERVAL\n\
done\n\
\n\
if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then\n\
  print_status "$ICON_FAILED" "Redis not ready"\n\
  exit 1\n\
fi\n\
print_status "$ICON_DONE" "Redis ready"\n\
\n\
# Step 3: Run migrations\n\
print_step "3" "5" "Running Migrations"\n\
echo "     $ICON_RUNNING Applying migrations..."\n\
MIGRATION_START=$(date +%%s)\n\
\n\
if npm run migration:run 2>&1; then\n\
  MIGRATION_END=$(date +%%s)\n\
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))\n\
  print_status "$ICON_DONE" "Migrations complete (${MIGRATION_DURATION}s)"\n\
else\n\
  print_status "$ICON_SKIP" "No pending migrations"\n\
fi\n\
\n\
# Step 4: Run seeding\n\
print_step "4" "5" "Running Seeding"\n\
echo "     $ICON_RUNNING Seeding database..."\n\
SEED_START=$(date +%%s)\n\
\n\
if npm run seed 2>&1; then\n\
  SEED_END=$(date +%%s)\n\
  SEED_DURATION=$((SEED_END - SEED_START))\n\
  print_status "$ICON_DONE" "Seeding complete (${SEED_DURATION}s)"\n\
else\n\
  print_status "$ICON_SKIP" "Seeding complete (data exists)"\n\
fi\n\
\n\
# Step 5: Start application\n\
print_step "5" "5" "Starting Application"\n\
echo "     $ICON_RUNNING Launching NestJS..."\n\
echo ""\n\
echo "╔══════════════════════════════════════════════════════════════╗"\n\
echo "║  $ICON_DONE STARTUP COMPLETE                                         ║"\n\
echo "║  API:    http://localhost:${PORT:-3000}/api/v1                        ║"\n\
echo "║  Health: http://localhost:${PORT:-3000}/api/v1/health                 ║"\n\
echo "╚══════════════════════════════════════════════════════════════╝"\n\
echo ""\n\
\n\
exec "$@"\n\
' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command - start in development mode with hot-reload
CMD ["npm", "run", "start:dev"]
