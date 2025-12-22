# BodaInsure Deployment Guide

This guide covers **production deployment** procedures for all BodaInsure platform components:
- **Backend API** (NestJS)
- **Web Portal** (React/Vite)
- **Mobile App** (React Native/Expo)

> **Looking for local development setup?** See [DEVELOPMENT.md](DEVELOPMENT.md) for the Docker-based development environment with `make dev-docker`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Backend Deployment](#3-backend-deployment)
4. [Web Portal Deployment](#4-web-portal-deployment)
5. [Mobile App Deployment](#5-mobile-app-deployment)
6. [Docker Deployment](#6-docker-deployment)
7. [Kubernetes Deployment](#7-kubernetes-deployment)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Environment Configuration](#9-environment-configuration)
10. [Health Checks & Monitoring](#10-health-checks--monitoring)
11. [Backup & Recovery](#11-backup--recovery)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture Overview

```
                                    ┌─────────────────┐
                                    │   CDN (Vercel)  │
                                    │   Web Portal    │
                                    └────────┬────────┘
                                             │
┌─────────────┐    ┌─────────────┐    ┌──────┴──────┐    ┌─────────────┐
│ Mobile App  │───▶│   Nginx     │───▶│  NestJS API │───▶│ PostgreSQL  │
│ (iOS/Andr)  │    │   (LB/SSL)  │    │  (Backend)  │    │ (Database)  │
└─────────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         ▼                   ▼                   ▼
                   ┌──────────┐       ┌──────────┐       ┌──────────┐
                   │  Redis   │       │   S3     │       │  M-Pesa  │
                   │ (Cache)  │       │(Storage) │       │  (Pay)   │
                   └──────────┘       └──────────┘       └──────────┘
```

---

## 2. Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20 LTS | Runtime |
| PostgreSQL | 15+ | Database |
| Redis | 7+ | Cache/Queue |
| Docker | 24+ | Containerization |
| Nginx | 1.24+ | Reverse Proxy |

### External Services

| Service | Provider | Purpose |
|---------|----------|---------|
| M-Pesa | Safaricom Daraja | Payments |
| SMS | Africa's Talking | OTP/Notifications |
| WhatsApp | Meta Business API | Policy Delivery |
| Storage | AWS S3 / GCP / Azure | Document Storage |

---

## 3. Backend Deployment

### 3.1 Build for Production

```bash
cd src/server

# Install dependencies
npm ci --production=false

# Build TypeScript
npm run build

# The built files will be in dist/
```

### 3.2 Database Migrations

```bash
# Run pending migrations
npm run migration:run

# Check migration status
npm run migration:show

# Revert last migration (if needed)
npm run migration:revert
```

### 3.3 Environment Configuration

Environment configuration is centralized at the **project root**:

```
bodainsure/
├── .env.example      # Template with all variables (committed)
├── .env.docker       # Docker development (gitignored)
├── .env.local        # Local development (gitignored)
└── .env.production   # Production secrets (gitignored)
```

For production, copy and configure `.env.production`:

```bash
# From project root
cp .env.example .env.production
# Edit .env.production with production values
```

Key production variables (see [Section 9](#9-environment-configuration) for full list):

```bash
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database
DB_HOST=your-db-host.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=bodainsure_prod
DB_PASSWORD=<secure-password>
DB_NAME=bodainsure_prod
DB_SSL=true

# Redis
REDIS_HOST=your-redis-host.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# JWT (use RS256 in production)
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY=/etc/secrets/jwt-private.pem
JWT_PUBLIC_KEY=/etc/secrets/jwt-public.pem

# Encryption
ENCRYPTION_KEY=<32-byte-hex-key>
```

### 3.4 Start Production Server

```bash
# Direct Node.js
npm run start:prod

# With PM2 (recommended)
pm2 start dist/main.js --name bodainsure-api -i max

# With systemd
sudo systemctl start bodainsure-api
```

### 3.5 Nginx Configuration

```nginx
# /etc/nginx/sites-available/bodainsure-api

upstream bodainsure_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 443 ssl http2;
    server_name api.bodainsure.co.ke;

    ssl_certificate /etc/letsencrypt/live/api.bodainsure.co.ke/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.bodainsure.co.ke/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # API endpoints
    location /api/v1 {
        proxy_pass http://bodainsure_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /api/v1/health {
        proxy_pass http://bodainsure_api;
        access_log off;
    }

    # Swagger docs (disable in production or restrict access)
    location /docs {
        deny all;
        return 404;
    }
}

# HTTP redirect
server {
    listen 80;
    server_name api.bodainsure.co.ke;
    return 301 https://$server_name$request_uri;
}
```

---

## 4. Web Portal Deployment

### 4.1 Build for Production

```bash
cd src/client

# Install dependencies
npm ci

# Build production bundle
npm run build

# Output will be in dist/
```

### 4.2 Environment Variables

The web portal uses `VITE_*` variables from the root `.env.production` file:

```bash
# These are already in .env.production at project root:
VITE_API_URL=https://api.bodainsure.co.ke/api/v1
VITE_APP_NAME=BodaInsure Admin
VITE_SESSION_TIMEOUT=30
VITE_ENABLE_MOCK_DATA=false
```

### 4.3 Deployment Options

#### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd src/client
vercel --prod
```

`vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

#### Option B: Nginx Static Hosting

```nginx
# /etc/nginx/sites-available/bodainsure-admin

server {
    listen 443 ssl http2;
    server_name admin.bodainsure.co.ke;

    ssl_certificate /etc/letsencrypt/live/admin.bodainsure.co.ke/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.bodainsure.co.ke/privkey.pem;

    root /var/www/bodainsure-admin/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache HTML
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
```

#### Option C: AWS S3 + CloudFront

```bash
# Sync build to S3
aws s3 sync dist/ s3://bodainsure-admin-prod --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id XXXXXXXXXXXXX \
  --paths "/*"
```

---

## 5. Mobile App Deployment

### 5.1 Build Configuration

Update `src/mobile/app.json`:

```json
{
  "expo": {
    "name": "BodaInsure",
    "slug": "bodainsure",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "co.ke.bodainsure.app",
      "buildNumber": "1"
    },
    "android": {
      "package": "co.ke.bodainsure.app",
      "versionCode": 1
    },
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

### 5.2 Environment Configuration

Create `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "API_URL": "https://staging-api.bodainsure.co.ke/api/v1"
      }
    },
    "production": {
      "env": {
        "API_URL": "https://api.bodainsure.co.ke/api/v1"
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      },
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id"
      }
    }
  }
}
```

### 5.3 Build for Android

```bash
cd src/mobile

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build Android APK (for internal testing)
eas build --platform android --profile preview

# Build Android AAB (for Play Store)
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

### 5.4 Build for iOS

```bash
# Build iOS (requires Apple Developer account)
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### 5.5 OTA Updates

```bash
# Publish JavaScript-only update (no native changes)
eas update --branch production --message "Bug fixes and improvements"
```

---

## 6. Docker Deployment

### 6.0 Development vs Production

BodaInsure provides two Docker configurations with centralized environment files:

| Environment | Docker Config | Env File | Purpose |
|-------------|---------------|----------|---------|
| **Development** | `docker/dev/` | `.env.docker` | Local development with hot-reload |
| **Production** | `docker/prod/` | `.env.production` | Production deployment |

All environment files are located at the **project root** (not in docker directories).

**For local development**, use the one-command setup:
```bash
make dev-docker          # Linux/Mac/Git Bash
dev-docker.cmd start     # Windows CMD
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for complete development setup guide.

### 6.1 Build Docker Images (Production)

```bash
# Build backend image
cd src/server
docker build -f ../../docker/prod/Dockerfile -t bodainsure-api:latest .

# Build web portal image
cd src/client
docker build -f ../../docker/prod/Dockerfile.client -t bodainsure-admin:latest .
```

### 6.2 Docker Compose (Production)

```bash
# Production uses .env.production from project root
cd docker/prod

# Start all services (specify env file from root)
docker compose --env-file ../../.env.production up -d

# View logs
docker compose logs -f api

# Stop services
docker compose down
```

### 6.3 Docker Compose File

```yaml
# docker/prod/docker-compose.yml
# Run with: docker compose --env-file ../../.env.production up -d
version: '3.8'

services:
  api:
    image: bodainsure-api:latest
    build:
      context: ../../src/server
      dockerfile: ../../docker/prod/Dockerfile
    container_name: bodainsure-api
    restart: unless-stopped
    # Environment variables are passed via --env-file flag
    environment:
      - NODE_ENV=production
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - bodainsure-network

  postgres:
    image: postgres:15-alpine
    container_name: bodainsure-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - bodainsure-network

  redis:
    image: redis:7-alpine
    container_name: bodainsure-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - bodainsure-network

  nginx:
    image: nginx:alpine
    container_name: bodainsure-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ../client/dist:/var/www/admin:ro
    depends_on:
      - api
    networks:
      - bodainsure-network

volumes:
  postgres-data:
  redis-data:

networks:
  bodainsure-network:
    driver: bridge
```

---

## 7. Kubernetes Deployment

### 7.1 Namespace

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: bodainsure
  labels:
    name: bodainsure
```

### 7.2 ConfigMap and Secrets

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bodainsure-config
  namespace: bodainsure
data:
  NODE_ENV: production
  PORT: "3000"
  API_PREFIX: api/v1
  DB_PORT: "5432"
  REDIS_PORT: "6379"
---
# k8s/secrets.yaml (use SealedSecrets or external secrets manager)
apiVersion: v1
kind: Secret
metadata:
  name: bodainsure-secrets
  namespace: bodainsure
type: Opaque
stringData:
  DB_PASSWORD: <base64-encoded>
  REDIS_PASSWORD: <base64-encoded>
  JWT_SECRET: <base64-encoded>
  ENCRYPTION_KEY: <base64-encoded>
```

### 7.3 Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bodainsure-api
  namespace: bodainsure
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bodainsure-api
  template:
    metadata:
      labels:
        app: bodainsure-api
    spec:
      containers:
        - name: api
          image: bodainsure-api:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: bodainsure-config
            - secretRef:
                name: bodainsure-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

### 7.4 Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: bodainsure-api
  namespace: bodainsure
spec:
  selector:
    app: bodainsure-api
  ports:
    - port: 80
      targetPort: 3000
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bodainsure-ingress
  namespace: bodainsure
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.bodainsure.co.ke
      secretName: bodainsure-tls
  rules:
    - host: api.bodainsure.co.ke
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: bodainsure-api
                port:
                  number: 80
```

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: src/server/package-lock.json

      - name: Install dependencies
        run: cd src/server && npm ci

      - name: Run tests
        run: cd src/server && npm test

      - name: Run linting
        run: cd src/server && npm run lint

  build-api:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: src/server
          file: docker/prod/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}

  build-web:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build web portal
        run: |
          cd src/client
          npm ci
          npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: src/client
          vercel-args: '--prod'

  deploy:
    needs: [build-api, build-web]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          manifests: |
            k8s/deployment.yaml
            k8s/service.yaml
          images: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}
```

---

## 9. Environment Configuration

### Environment File Structure

All environment configuration is centralized at the **project root**:

```
bodainsure/
├── .env.example      # Template with all variables (committed to git)
├── .env.docker       # Docker development - uses service names (gitignored)
├── .env.local        # Local development - uses localhost (gitignored)
└── .env.production   # Production secrets (gitignored)
```

| File | Purpose | Hostnames |
|------|---------|-----------|
| `.env.docker` | Docker Compose development | `postgres`, `redis`, `minio` |
| `.env.local` | Local development (no Docker) | `localhost` |
| `.env.production` | Production deployment | Production URLs |

### Complete Environment Variables Reference

```bash
# ===========================================
# APPLICATION
# ===========================================
NODE_ENV=production                     # development | staging | production
PORT=3000                               # API port
API_PREFIX=api/v1                       # API route prefix

# ===========================================
# DATABASE (PostgreSQL)
# ===========================================
DB_HOST=localhost                       # Database host
DB_PORT=5432                            # Database port
DB_USERNAME=bodainsure                  # Database user
DB_PASSWORD=                            # Database password (REQUIRED)
DB_NAME=bodainsure                      # Database name
DB_SSL=false                            # Enable SSL (true for production)
DB_LOGGING=false                        # Enable query logging
DB_POOL_SIZE=10                         # Connection pool size

# ===========================================
# REDIS
# ===========================================
REDIS_HOST=localhost                    # Redis host
REDIS_PORT=6379                         # Redis port
REDIS_PASSWORD=                         # Redis password
REDIS_DB=0                              # Redis database number

# ===========================================
# AUTHENTICATION
# ===========================================
JWT_ALGORITHM=RS256                     # RS256 (recommended) or HS256
JWT_SECRET=                             # Required for HS256
JWT_PRIVATE_KEY=                        # Path or base64 for RS256
JWT_PUBLIC_KEY=                         # Path or base64 for RS256
JWT_EXPIRES_IN=30d                      # Token expiry (mobile)
JWT_WEB_EXPIRES_IN=30m                  # Token expiry (web)

# ===========================================
# ENCRYPTION
# ===========================================
ENCRYPTION_KEY=                         # 32-byte hex key for AES-256

# ===========================================
# M-PESA (Safaricom Daraja)
# ===========================================
MPESA_ENABLED=true                      # Enable M-Pesa
MPESA_ENVIRONMENT=production            # sandbox | production
MPESA_CONSUMER_KEY=                     # Daraja consumer key
MPESA_CONSUMER_SECRET=                  # Daraja consumer secret
MPESA_SHORTCODE=                        # Business shortcode
MPESA_PASSKEY=                          # Lipa Na M-Pesa passkey
MPESA_CALLBACK_URL=                     # STK callback URL

# B2C Configuration (for refunds)
MPESA_B2C_SHORTCODE=                    # B2C shortcode
MPESA_B2C_INITIATOR_NAME=               # Initiator name
MPESA_B2C_SECURITY_CREDENTIAL=          # Security credential
MPESA_B2C_RESULT_URL=                   # B2C result URL
MPESA_B2C_QUEUE_TIMEOUT_URL=            # B2C timeout URL

# ===========================================
# SMS (Africa's Talking)
# ===========================================
SMS_ENABLED=true                        # Enable SMS
AT_API_KEY=                             # Africa's Talking API key
AT_USERNAME=                            # Africa's Talking username
AT_SENDER_ID=BodaInsure                 # SMS sender ID

# ===========================================
# WHATSAPP (Meta Business API)
# ===========================================
WHATSAPP_ENABLED=true                   # Enable WhatsApp
WHATSAPP_ACCESS_TOKEN=                  # Meta access token
WHATSAPP_PHONE_NUMBER_ID=               # Phone number ID
WHATSAPP_BUSINESS_ACCOUNT_ID=           # Business account ID

# ===========================================
# EMAIL (SMTP)
# ===========================================
EMAIL_ENABLED=true                      # Enable email
EMAIL_FROM=noreply@bodainsure.co.ke     # From address
SMTP_HOST=                              # SMTP host
SMTP_PORT=587                           # SMTP port
SMTP_USER=                              # SMTP username
SMTP_PASS=                              # SMTP password
SMTP_SECURE=false                       # Use TLS

# ===========================================
# STORAGE
# ===========================================
STORAGE_PROVIDER=aws                    # aws | gcp | azure | local

# AWS S3
AWS_ACCESS_KEY_ID=                      # AWS access key
AWS_SECRET_ACCESS_KEY=                  # AWS secret key
AWS_REGION=af-south-1                   # AWS region
STORAGE_BUCKET_KYC=bodainsure-kyc       # KYC documents bucket
STORAGE_BUCKET_POLICIES=bodainsure-pol  # Policy documents bucket

# ===========================================
# USSD
# ===========================================
USSD_ENABLED=true                       # Enable USSD
USSD_SHORTCODE=*384*123#                # USSD shortcode

# ===========================================
# SCHEDULER
# ===========================================
SCHEDULER_ENABLED=true                  # Enable scheduler
GRACE_PERIOD_DAYS=7                     # Grace period days

# ===========================================
# RATE LIMITING
# ===========================================
RATE_LIMIT_TTL=60                       # Window in seconds
RATE_LIMIT_MAX=100                      # Max requests per window

# ===========================================
# CORS
# ===========================================
CORS_ORIGIN=https://admin.bodainsure.co.ke,https://bodainsure.co.ke
```

---

## 10. Health Checks & Monitoring

### 10.1 Health Endpoint

The API exposes a health check endpoint at `/api/v1/health`:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "storage": { "status": "up" }
  },
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "storage": { "status": "up" }
  }
}
```

### 10.2 Prometheus Metrics

Add metrics endpoint by installing `@willsoto/nestjs-prometheus`:

```bash
GET /api/v1/metrics
```

### 10.3 Logging

Logs are structured JSON for easy parsing:

```json
{
  "level": "info",
  "timestamp": "2024-12-14T10:30:00.000Z",
  "context": "PaymentService",
  "message": "Payment processed successfully",
  "requestId": "uuid",
  "userId": "uuid",
  "amount": 87
}
```

---

## 11. Backup & Recovery

### 11.1 Database Backup

```bash
# Automated daily backup script
#!/bin/bash
BACKUP_DIR=/var/backups/postgres
FILENAME=bodainsure_$(date +%Y%m%d_%H%M%S).sql.gz

pg_dump -h $DB_HOST -U $DB_USERNAME $DB_NAME | gzip > $BACKUP_DIR/$FILENAME

# Upload to S3
aws s3 cp $BACKUP_DIR/$FILENAME s3://bodainsure-backups/postgres/

# Keep only last 30 days locally
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### 11.2 Database Restore

```bash
# Restore from backup
gunzip -c backup.sql.gz | psql -h $DB_HOST -U $DB_USERNAME $DB_NAME
```

### 11.3 Redis Backup

Redis is configured with AOF persistence. Backup `/data/appendonly.aof`.

---

## 12. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| API returns 502 | Backend not running | Check `pm2 status` or container logs |
| Database connection failed | Wrong credentials | Verify DB_* env vars |
| M-Pesa callback not received | Firewall/SSL issue | Ensure HTTPS, check callback URL |
| High memory usage | Memory leak | Restart pods, check for leaks |
| Slow API response | Database queries | Add indexes, optimize queries |

### Debug Commands

```bash
# Check API logs
docker logs bodainsure-api -f
pm2 logs bodainsure-api

# Check database connections
psql -h $DB_HOST -U $DB_USERNAME -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD ping

# Test M-Pesa connectivity
curl -X POST https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials \
  -H "Authorization: Basic $(echo -n $MPESA_CONSUMER_KEY:$MPESA_CONSUMER_SECRET | base64)"
```

---

## 13. Additional Resources

For more detailed information, refer to:

- [Configuration Guide](./ref_docs/guides/configuration-guide.md) - Complete environment variable reference
- [User Guides](./ref_docs/guides/) - Role-specific documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup

---

*Last updated: December 2024*
