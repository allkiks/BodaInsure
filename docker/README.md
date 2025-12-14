# BodaInsure Docker Configuration

This directory contains Docker configurations for both development and production environments.

## Directory Structure

```
docker/
├── dev/                    # Development environment
│   ├── docker-compose.yml  # Development services
│   ├── Dockerfile          # Dev container with hot-reload
│   └── init-db.sql         # Database initialization
├── prod/                   # Production environment
│   ├── docker-compose.yml  # Production services
│   ├── Dockerfile          # Optimized production container
│   ├── init-db.sql         # Database initialization
│   ├── .env.example        # Environment variables template
│   └── nginx/              # Reverse proxy configuration
│       ├── nginx.conf      # Nginx configuration
│       └── ssl/            # SSL certificates (not in git)
└── README.md               # This file
```

## Development Environment

### Prerequisites
- Docker Desktop or Docker Engine
- Docker Compose v2+

### Services Included
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Sessions & queues |
| pgAdmin | 8080 | Database admin UI |
| Redis Commander | 8081 | Redis admin UI |
| MailHog | 8025 | Email testing UI |

### Quick Start

```bash
# Start all development services
docker-compose -f docker/dev/docker-compose.yml up -d

# View logs
docker-compose -f docker/dev/docker-compose.yml logs -f

# Stop services
docker-compose -f docker/dev/docker-compose.yml down

# Stop and remove volumes (reset data)
docker-compose -f docker/dev/docker-compose.yml down -v
```

### Accessing Services

- **pgAdmin**: http://localhost:8080
  - Email: `admin@bodainsure.co.ke`
  - Password: `admin123`
  - Add server: Host=`postgres`, User=`bodainsure`, Password=`bodainsure`

- **Redis Commander**: http://localhost:8081

- **MailHog**: http://localhost:8025

### Running the API with Docker Services

1. Start Docker services:
   ```bash
   docker-compose -f docker/dev/docker-compose.yml up -d postgres redis
   ```

2. Start the API locally:
   ```bash
   cd src/server
   npm run start:dev
   ```

## Production Environment

### Prerequisites
- Docker Engine on Linux server
- Docker Compose v2+
- SSL certificates
- Domain name configured

### Setup

1. **Copy environment file:**
   ```bash
   cp docker/prod/.env.example docker/prod/.env
   ```

2. **Edit environment variables:**
   ```bash
   nano docker/prod/.env
   # Update all CHANGE_ME values with secure passwords
   ```

3. **Add SSL certificates:**
   ```bash
   # Place your SSL certificates in docker/prod/nginx/ssl/
   # - fullchain.pem
   # - privkey.pem
   ```

4. **Build and start:**
   ```bash
   docker-compose -f docker/prod/docker-compose.yml up -d --build
   ```

### Production Commands

```bash
# View status
docker-compose -f docker/prod/docker-compose.yml ps

# View logs
docker-compose -f docker/prod/docker-compose.yml logs -f api

# Restart API
docker-compose -f docker/prod/docker-compose.yml restart api

# Update API (rebuild and restart)
docker-compose -f docker/prod/docker-compose.yml up -d --build api

# Database backup
docker exec bodainsure-postgres-prod pg_dump -U $DB_USERNAME $DB_NAME > backup.sql
```

### Health Checks

All services include health checks. Monitor with:
```bash
docker-compose -f docker/prod/docker-compose.yml ps
```

### Resource Limits

Production services have configured resource limits:
- PostgreSQL: 2 CPU, 4GB RAM
- Redis: 1 CPU, 1GB RAM
- API: 2 CPU, 2GB RAM

Adjust in `docker-compose.yml` based on your server capacity.

## Security Notes

1. **Never commit:**
   - `.env` files with real credentials
   - SSL private keys
   - Database backups

2. **Production secrets:**
   - Generate strong passwords: `openssl rand -base64 32`
   - Generate JWT secret: `openssl rand -base64 64`
   - Generate encryption key: `openssl rand -hex 32`

3. **Network security:**
   - Production services bind to `127.0.0.1` (localhost only)
   - Use Nginx reverse proxy for external access
   - Enable firewall, only allow ports 80 and 443

## Troubleshooting

### Database connection refused
```bash
# Check if PostgreSQL is running
docker-compose -f docker/dev/docker-compose.yml ps postgres

# Check PostgreSQL logs
docker-compose -f docker/dev/docker-compose.yml logs postgres
```

### Redis connection refused
```bash
# Check if Redis is running
docker-compose -f docker/dev/docker-compose.yml ps redis

# Test Redis connection
docker exec bodainsure-redis-dev redis-cli ping
```

### Reset development environment
```bash
# Stop and remove all containers and volumes
docker-compose -f docker/dev/docker-compose.yml down -v

# Start fresh
docker-compose -f docker/dev/docker-compose.yml up -d
```
