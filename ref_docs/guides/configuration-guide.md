# BodaInsure Configuration Guide

**Last Updated:** December 2024
**Version:** 1.0

This guide documents all configurable options for the BodaInsure platform, including environment variables, feature flags, external service dependencies, and default values.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Configuration Sources](#2-configuration-sources)
3. [Application Configuration](#3-application-configuration)
4. [Database Configuration](#4-database-configuration)
5. [Redis Configuration](#5-redis-configuration)
6. [Authentication Configuration](#6-authentication-configuration)
7. [Storage Configuration](#7-storage-configuration)
8. [M-Pesa Payment Configuration](#8-m-pesa-payment-configuration)
9. [SMS Gateway Configuration](#9-sms-gateway-configuration)
10. [WhatsApp Configuration](#10-whatsapp-configuration)
11. [Email Configuration](#11-email-configuration)
12. [USSD Configuration](#12-ussd-configuration)
13. [Scheduler & Queue Configuration](#13-scheduler--queue-configuration)
14. [Client Configuration](#14-client-configuration)
15. [Development Tools](#15-development-tools)

---

## 1. Overview

BodaInsure uses environment variables for configuration across all environments. The configuration is:

- **Development**: Managed via `docker/dev/.env` (copy from `.env.example`)
- **Production**: Managed via environment variables or secrets management

### Configuration Principles

1. **Sensible Defaults**: Most variables have defaults suitable for development
2. **Environment Detection**: Behavior adjusts based on `NODE_ENV`
3. **Feature Flags**: External services can be enabled/disabled independently
4. **Secret Management**: Sensitive values should use secrets management in production

---

## 2. Configuration Sources

### For Docker Development

```bash
# Copy example configuration
cp docker/dev/.env.example docker/dev/.env

# Edit as needed
nano docker/dev/.env
```

### For Manual Development

```bash
# In src/server directory
cp .env.example .env

# In src/client directory
echo "VITE_API_URL=http://localhost:3000/api/v1" > .env.local
```

### For Production

Use your deployment platform's secrets management:
- AWS: Systems Manager Parameter Store or Secrets Manager
- Azure: Key Vault
- GCP: Secret Manager
- Kubernetes: ConfigMaps and Secrets

---

## 3. Application Configuration

### Core Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode: `development`, `staging`, `production` |
| `PORT` | No | `3000` | API server port |
| `API_PREFIX` | No | `api/v1` | API route prefix |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_TTL` | No | `60` | Rate limit window in seconds |
| `RATE_LIMIT_MAX` | No | `100` | Maximum requests per window |

### CORS Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGIN` | No | `http://localhost:3000` | Allowed origins (comma-separated) |

**Example:**
```bash
CORS_ORIGIN=http://localhost:5173,http://client:5173,https://admin.bodainsure.co.ke
```

---

## 4. Database Configuration

PostgreSQL is the primary database. All tables use UUIDs for primary keys and follow the schema defined in migrations.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | **Yes** | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_USERNAME` | **Yes** | `bodainsure` | Database username |
| `DB_PASSWORD` | **Yes** | `bodainsure` | Database password |
| `DB_NAME` | **Yes** | `bodainsure` | Database name |
| `DB_SSL` | No | `false` | Enable SSL (`true` for production) |
| `DB_LOGGING` | No | `false` | Enable query logging |
| `DB_POOL_SIZE` | No | `10` | Connection pool size |

### Production Database Settings

For production, ensure:
- `DB_SSL=true` for encrypted connections
- Strong, unique `DB_PASSWORD`
- Appropriate `DB_POOL_SIZE` for expected load
- `DB_LOGGING=false` for performance

**Example (Production):**
```bash
DB_HOST=bodainsure-prod.xxxxx.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=bodainsure_prod
DB_PASSWORD=<strong-password>
DB_NAME=bodainsure_prod
DB_SSL=true
DB_LOGGING=false
DB_POOL_SIZE=20
```

---

## 5. Redis Configuration

Redis is used for sessions, caching, and job queues (BullMQ).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | **Yes** | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | *(empty)* | Redis password (required in production) |
| `REDIS_DB` | No | `0` | Redis database number |

### Production Redis Settings

```bash
REDIS_HOST=bodainsure-redis.xxxxx.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_DB=0
```

---

## 6. Authentication Configuration

BodaInsure uses JWT for authentication. Both RS256 (recommended for production) and HS256 are supported.

### JWT Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_ALGORITHM` | No | Auto-detected | `RS256` or `HS256` |
| `JWT_SECRET` | Conditional | Dev: auto-generated | Secret for HS256 (min 32 chars) |
| `JWT_PRIVATE_KEY` | Conditional | Dev: auto-generated | RSA private key for RS256 |
| `JWT_PUBLIC_KEY` | Conditional | Dev: auto-generated | RSA public key for RS256 |
| `JWT_PRIVATE_KEY_PATH` | No | - | Path to private key file |
| `JWT_PUBLIC_KEY_PATH` | No | - | Path to public key file |
| `JWT_EXPIRES_IN` | No | `30d` | Token expiration (mobile) |
| `JWT_REFRESH_EXPIRES_IN` | No | `90d` | Refresh token expiration |
| `JWT_MOBILE_EXPIRES_IN` | No | `30d` | Mobile app token expiration |
| `JWT_WEB_EXPIRES_IN` | No | `30m` | Web portal token expiration |

### Development (HS256)

```bash
JWT_SECRET=docker-dev-secret-change-in-production-min-32-chars
JWT_ALGORITHM=HS256
```

### Production (RS256 - Recommended)

```bash
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/etc/secrets/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/etc/secrets/jwt-public.pem
```

Or with base64-encoded keys:
```bash
JWT_PRIVATE_KEY=<base64-encoded-private-key>
JWT_PUBLIC_KEY=<base64-encoded-public-key>
```

### Encryption Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | **Yes** | - | 32-byte key for AES-256-GCM encryption of PII |
| `ENCRYPTION_KEY_VERSION` | No | `1` | Key version for rotation support |

**Generate encryption key:**
```bash
openssl rand -base64 32
```

---

## 7. Storage Configuration

BodaInsure supports multiple object storage providers for KYC documents, policies, and claims.

### Storage Provider Selection

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_PROVIDER` | No | `local` | Provider: `aws`, `gcp`, `azure`, `local` |

### Bucket Names

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_BUCKET_KYC` | No | `kyc-documents` | KYC documents bucket/container |
| `STORAGE_BUCKET_POLICIES` | No | `policy-documents` | Policy documents bucket |
| `STORAGE_BUCKET_CLAIMS` | No | `claim-documents` | Claim documents bucket |

### AWS S3 Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | If AWS | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | If AWS | - | AWS secret key |
| `AWS_REGION` | No | `eu-west-1` | AWS region |
| `AWS_S3_ENDPOINT` | No | - | Custom endpoint (MinIO) |
| `AWS_S3_FORCE_PATH_STYLE` | No | `false` | Use path-style URLs (MinIO) |

**Production Example:**
```bash
STORAGE_PROVIDER=aws
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=af-south-1
STORAGE_BUCKET_KYC=bodainsure-kyc-prod
STORAGE_BUCKET_POLICIES=bodainsure-policies-prod
```

**Development (MinIO):**
```bash
STORAGE_PROVIDER=aws
AWS_ACCESS_KEY_ID=bodainsure
AWS_SECRET_ACCESS_KEY=bodainsure123
AWS_REGION=us-east-1
AWS_S3_ENDPOINT=http://minio:9000
AWS_S3_FORCE_PATH_STYLE=true
```

### GCP Cloud Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GCP_PROJECT_ID` | If GCP | - | GCP project ID |
| `GCP_KEY_FILE_PATH` | If GCP | - | Path to service account JSON |
| `GCP_CREDENTIALS` | If GCP | - | JSON string of credentials |

### Azure Blob Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_STORAGE_CONNECTION_STRING` | If Azure | - | Full connection string |
| `AZURE_STORAGE_ACCOUNT_NAME` | If Azure | - | Storage account name |
| `AZURE_STORAGE_ACCOUNT_KEY` | If Azure | - | Storage account key |

### Local Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STORAGE_LOCAL_PATH` | No | `./docstore` | Local filesystem path |

---

## 8. M-Pesa Payment Configuration

M-Pesa is the primary payment method via Safaricom's Daraja API.

### Core M-Pesa Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MPESA_ENABLED` | No | `false` | Enable M-Pesa integration |
| `MPESA_ENVIRONMENT` | No | `sandbox` | `sandbox` or `production` |
| `MPESA_CONSUMER_KEY` | If enabled | - | Daraja API consumer key |
| `MPESA_CONSUMER_SECRET` | If enabled | - | Daraja API consumer secret |
| `MPESA_SHORTCODE` | If enabled | - | Business shortcode (paybill) |
| `MPESA_PASSKEY` | If enabled | - | Lipa Na M-Pesa passkey |
| `MPESA_CALLBACK_URL` | If enabled | - | STK Push callback URL (HTTPS) |

### B2C Configuration (Refunds)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MPESA_B2C_SHORTCODE` | If B2C | - | B2C shortcode |
| `MPESA_B2C_INITIATOR_NAME` | If B2C | - | B2C initiator name |
| `MPESA_B2C_SECURITY_CREDENTIAL` | If B2C | - | Encrypted credential |
| `MPESA_B2C_RESULT_URL` | If B2C | - | B2C result callback URL |
| `MPESA_B2C_QUEUE_TIMEOUT_URL` | If B2C | - | B2C timeout callback URL |

**Production Example:**
```bash
MPESA_ENABLED=true
MPESA_ENVIRONMENT=production
MPESA_CONSUMER_KEY=<your-consumer-key>
MPESA_CONSUMER_SECRET=<your-consumer-secret>
MPESA_SHORTCODE=123456
MPESA_PASSKEY=<your-passkey>
MPESA_CALLBACK_URL=https://api.bodainsure.co.ke/api/v1/payments/mpesa/callback
```

---

## 9. SMS Gateway Configuration

BodaInsure supports multiple SMS providers with automatic failover.

### SMS Orchestration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMS_ENABLED` | No | `false` | Enable SMS functionality |
| `SMS_PRIMARY_PROVIDER` | No | `africastalking` | Primary SMS provider |
| `SMS_FALLBACK_PROVIDER` | No | `advantasms` | Fallback SMS provider |
| `SMS_MAX_RETRIES` | No | `3` | Max retry attempts |
| `SMS_RETRY_DELAY_MS` | No | `1000` | Delay between retries (ms) |

### Africa's Talking Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AT_ENABLED` | No | `false` | Enable Africa's Talking |
| `AT_API_KEY` | If enabled | - | AT API key |
| `AT_USERNAME` | If enabled | `sandbox` | AT username |
| `AT_SENDER_ID` | No | `BodaInsure` | SMS sender ID |
| `AT_USSD_CALLBACK_URL` | No | - | USSD callback URL |

### AdvantaSMS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADVANTASMS_ENABLED` | No | `false` | Enable AdvantaSMS |
| `ADVANTASMS_BASE_URL` | No | See default | AdvantaSMS API base URL |
| `ADVANTASMS_API_KEY` | If enabled | - | AdvantaSMS API key |
| `ADVANTASMS_PARTNER_ID` | If enabled | - | AdvantaSMS partner ID |
| `ADVANTASMS_SENDER_ID` | No | `BodaInsure` | SMS sender ID |
| `ADVANTASMS_USSD_CALLBACK_URL` | No | - | USSD callback URL |

---

## 10. WhatsApp Configuration

WhatsApp Business API is used for policy delivery and notifications.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WHATSAPP_ENABLED` | No | `false` | Enable WhatsApp integration |
| `WHATSAPP_ACCESS_TOKEN` | If enabled | - | Meta Business API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | If enabled | - | WhatsApp phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | If enabled | - | Business account ID |
| `WHATSAPP_API_VERSION` | No | `v18.0` | Graph API version |

---

## 11. Email Configuration

SMTP configuration for email notifications.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_ENABLED` | No | `false` | Enable email functionality |
| `EMAIL_FROM` | No | `noreply@bodainsure.co.ke` | From address |
| `EMAIL_REPLY_TO` | No | - | Reply-to address |
| `SMTP_HOST` | If enabled | - | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | If enabled | - | SMTP username |
| `SMTP_PASS` | If enabled | - | SMTP password |
| `SMTP_SECURE` | No | `false` | Use TLS/SSL |

**Development (MailHog):**
```bash
EMAIL_ENABLED=true
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
```

---

## 12. USSD Configuration

USSD gateway configuration for feature phone users.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `USSD_ENABLED` | No | `false` | Enable USSD channel |
| `USSD_PRIMARY_PROVIDER` | No | `africastalking` | USSD provider |
| `USSD_SHORTCODE` | If enabled | `*384*123#` | USSD service code |
| `USSD_SERVICE_CODE` | If enabled | `*384*123#` | Service code alias |

---

## 13. Scheduler & Queue Configuration

Background job processing and scheduled tasks.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCHEDULER_ENABLED` | No | `true` | Enable scheduled jobs |
| `GRACE_PERIOD_DAYS` | No | `7` | Payment grace period in days |
| `QUEUE_DEFAULT_ATTEMPTS` | No | `3` | Default job retry attempts |
| `QUEUE_DEFAULT_BACKOFF` | No | `exponential` | Backoff strategy |

### Batch Processing Schedule

Batch processing runs at these times (East Africa Time):
- **Batch 1:** 08:00 EAT
- **Batch 2:** 14:00 EAT
- **Batch 3:** 20:00 EAT

---

## 14. Client Configuration

Frontend (Vite) configuration.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | **Yes** | - | Backend API URL |
| `VITE_APP_NAME` | No | `BodaInsure Admin` | Application name |
| `VITE_SESSION_TIMEOUT` | No | `30` | Session timeout in minutes |
| `VITE_ENABLE_MOCK_DATA` | No | `false` | Enable mock data for testing |
| `DOCKER_ENV` | No | `false` | Running in Docker |

---

## 15. Development Tools

Optional tools for the development environment.

### pgAdmin Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PGADMIN_EMAIL` | No | `admin@bodainsure.co.ke` | pgAdmin login email |
| `PGADMIN_PASSWORD` | No | `admin123` | pgAdmin password |

### MinIO Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MINIO_ROOT_USER` | No | `bodainsure` | MinIO root username |
| `MINIO_ROOT_PASSWORD` | No | `bodainsure123` | MinIO root password |

---

## Quick Reference: Development vs Production

### Development Configuration

```bash
NODE_ENV=development
DB_HOST=postgres
DB_SSL=false
DB_LOGGING=true
JWT_SECRET=docker-dev-secret-change-in-production-min-32-chars
MPESA_ENABLED=false
SMS_ENABLED=false
WHATSAPP_ENABLED=false
STORAGE_PROVIDER=aws
AWS_S3_ENDPOINT=http://minio:9000
```

### Production Configuration

```bash
NODE_ENV=production
DB_HOST=<production-db-host>
DB_SSL=true
DB_LOGGING=false
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/etc/secrets/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/etc/secrets/jwt-public.pem
MPESA_ENABLED=true
MPESA_ENVIRONMENT=production
SMS_ENABLED=true
WHATSAPP_ENABLED=true
STORAGE_PROVIDER=aws
AWS_REGION=af-south-1
```

---

## Security Considerations

1. **Never commit `.env` files** with real credentials
2. **Use strong, unique passwords** for all services in production
3. **Enable SSL/TLS** for all database and Redis connections in production
4. **Rotate secrets regularly**, especially encryption keys
5. **Use RS256** for JWT signing in production (not HS256)
6. **Restrict CORS origins** to known domains in production

---

## Related Documentation

- [DEVELOPMENT.md](../../DEVELOPMENT.md) - Local development setup
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Production deployment guide
- [User Guides](./README.md) - Role-specific user guides

---

*For questions or issues with configuration, contact the Platform Admin team.*
