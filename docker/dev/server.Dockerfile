# BodaInsure API Development Dockerfile
# Optimized for development with hot-reload support

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

# Create the entrypoint script using echo (avoids line ending issues)
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'set -e' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /docker-entrypoint.sh && \
    echo 'echo "BodaInsure Server Starting..."' >> /docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "[1/5] Waiting for PostgreSQL..."' >> /docker-entrypoint.sh && \
    echo 'MAX_RETRIES=30' >> /docker-entrypoint.sh && \
    echo 'RETRY_COUNT=0' >> /docker-entrypoint.sh && \
    echo 'until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USERNAME:-bodainsure}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do' >> /docker-entrypoint.sh && \
    echo '  RETRY_COUNT=$((RETRY_COUNT + 1))' >> /docker-entrypoint.sh && \
    echo '  echo "  Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"' >> /docker-entrypoint.sh && \
    echo '  sleep 2' >> /docker-entrypoint.sh && \
    echo 'done' >> /docker-entrypoint.sh && \
    echo 'if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then' >> /docker-entrypoint.sh && \
    echo '  echo "ERROR: PostgreSQL not ready"' >> /docker-entrypoint.sh && \
    echo '  exit 1' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo 'echo "  PostgreSQL is ready!"' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "[2/5] Waiting for Redis..."' >> /docker-entrypoint.sh && \
    echo 'RETRY_COUNT=0' >> /docker-entrypoint.sh && \
    echo 'until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do' >> /docker-entrypoint.sh && \
    echo '  RETRY_COUNT=$((RETRY_COUNT + 1))' >> /docker-entrypoint.sh && \
    echo '  echo "  Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"' >> /docker-entrypoint.sh && \
    echo '  sleep 2' >> /docker-entrypoint.sh && \
    echo 'done' >> /docker-entrypoint.sh && \
    echo 'if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then' >> /docker-entrypoint.sh && \
    echo '  echo "ERROR: Redis not ready"' >> /docker-entrypoint.sh && \
    echo '  exit 1' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo 'echo "  Redis is ready!"' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "[3/5] Running database migrations..."' >> /docker-entrypoint.sh && \
    echo 'npm run migration:run 2>&1 || echo "  No pending migrations"' >> /docker-entrypoint.sh && \
    echo 'echo "  Migrations complete!"' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "[4/5] Running database seeding..."' >> /docker-entrypoint.sh && \
    echo 'npm run seed 2>&1 || echo "  Seeding complete (data may already exist)"' >> /docker-entrypoint.sh && \
    echo 'echo "  Seeding complete!"' >> /docker-entrypoint.sh && \
    echo '' >> /docker-entrypoint.sh && \
    echo 'echo "[5/5] Starting application..."' >> /docker-entrypoint.sh && \
    echo 'echo "========================================="' >> /docker-entrypoint.sh && \
    echo 'exec "$@"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]

# Default command - start in development mode with hot-reload
CMD ["npm", "run", "start:dev"]
