# BodaInsure Platform

Digital insurance platform enabling Kenya's 700,000+ bodaboda (motorcycle taxi) riders to access mandatory Third-Party Only (TPO) insurance through an affordable micropayment model.

---

## Overview

BodaInsure transforms the traditional lump-sum insurance payment (3,500 KES annually) into a flexible micropayment system:

| Step | Amount | Coverage |
|------|--------|----------|
| Initial Deposit | 1,048 KES | 1-month policy issued |
| Daily Payments | 87 KES x 30 days | 11-month policy issued |
| **Total** | **3,658 KES** | **Full year coverage** |

### Key Features

- **Multi-Channel Access**: Mobile app (Android/iOS), USSD, Web portal, WhatsApp
- **M-Pesa Integration**: Native STK Push payments
- **Automated Policy Generation**: Policies issued within 6 hours
- **SACCO/KBA Management**: Organization hierarchy and compliance tracking
- **Real-time Notifications**: SMS, WhatsApp, and email alerts

### Stakeholders

| Entity | Role |
|--------|------|
| Atronach K Ltd | Platform owner/developer |
| Robs Insurance Agency | Insurance agent (JV partner) |
| Definite Assurance Co. | Underwriter |
| Kenya Bodaboda Association (KBA) | Launch client |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHANNELS                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Mobile  │  │  Admin   │  │   USSD   │  │ WhatsApp │  │   SMS    │  │
│  │   App    │  │   Web    │  │ Gateway  │  │   API    │  │ Gateway  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼────────┘
        │             │             │             │             │
        └─────────────┴──────┬──────┴─────────────┴─────────────┘
                             │
                    ┌────────▼────────┐
                    │   NestJS API    │
                    │  (Backend API)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│  PostgreSQL   │   │     Redis     │   │  Object Store │
│  (Database)   │   │ (Cache/Queue) │   │  (Documents)  │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Backend API | NestJS 11, TypeScript, Node.js 20 |
| Frontend Web | React 19, Vite, TailwindCSS |
| Mobile App | React Native, Expo |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis 7, BullMQ |
| Storage | AWS S3 / GCP / Azure / MinIO |
| Payments | M-Pesa Daraja API |
| Notifications | Africa's Talking, Meta WhatsApp API |

---

## Prerequisites

- **Node.js** 20 LTS
- **Docker** 24+ and Docker Compose
- **Git** 2.40+

For mobile development:
- Android Studio (Android)
- Xcode (iOS, Mac only)
- Expo Go app on device

---

## Quick Start (Docker Development)

The recommended development approach uses Docker for all services:

### Linux/Mac/Git Bash

```bash
# Clone repository
git clone https://github.com/your-org/bodainsure.git
cd bodainsure

# Start everything
make dev-docker
```

### Windows (CMD/PowerShell)

```cmd
git clone https://github.com/your-org/bodainsure.git
cd bodainsure

# Start everything
dev-docker.cmd start
```

### Services Available

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend (Admin) | http://localhost:5173 | - |
| Backend API | http://localhost:3000/api/v1 | - |
| API Documentation | http://localhost:3000/docs | - |
| PostgreSQL | localhost:5432 | bodainsure/bodainsure |
| Redis | localhost:6379 | - |
| MinIO Console | http://localhost:9001 | bodainsure/bodainsure123 |
| MailHog (Email) | http://localhost:8025 | - |

### Useful Commands

| Command | Description |
|---------|-------------|
| `make dev-docker` | Start full environment |
| `make dev-docker-down` | Stop all services |
| `make dev-docker-logs` | View logs |
| `make dev-migrate` | Run database migrations |
| `make dev-shell-server` | Open server container shell |

For Windows, use `dev-docker.cmd` with equivalent commands: `start`, `stop`, `logs`, `migrate`, `shell`.

---

## Project Structure

```
bodainsure/
├── src/
│   ├── server/              # NestJS Backend API
│   │   ├── src/
│   │   │   ├── common/      # Shared utilities
│   │   │   ├── config/      # Configuration
│   │   │   ├── database/    # Migrations
│   │   │   └── modules/     # Feature modules
│   │   │       ├── identity/    # Auth, users
│   │   │       ├── kyc/         # KYC documents
│   │   │       ├── payment/     # Payments, wallets
│   │   │       ├── policy/      # Insurance policies
│   │   │       ├── organization/# SACCOs, KBA
│   │   │       ├── notification/# SMS, WhatsApp, Email
│   │   │       ├── reporting/   # Dashboards
│   │   │       ├── scheduler/   # Batch jobs
│   │   │       ├── audit/       # Audit logging
│   │   │       ├── ussd/        # USSD channel
│   │   │       └── queue/       # Job processing
│   │   └── package.json
│   │
│   ├── client/              # React Admin Portal
│   └── mobile/              # React Native App
│
├── docker/
│   └── dev/                 # Docker development config
│
├── ref_docs/                # Reference documentation
│   ├── guides/              # User and configuration guides
│   └── *.md                 # Specifications
│
├── CLAUDE.md                # AI governance rules
├── DEVELOPMENT.md           # Development guide
├── DEPLOYMENT.md            # Deployment guide
└── README.md                # This file
```

---

## Configuration

All configuration is managed via environment variables. For local development, copy the example file:

```bash
cp docker/dev/.env.example docker/dev/.env
```

Key configuration categories:

| Category | Variables |
|----------|-----------|
| Application | `NODE_ENV`, `PORT`, `API_PREFIX` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` |
| Redis | `REDIS_HOST`, `REDIS_PORT` |
| Authentication | `JWT_SECRET`, `JWT_EXPIRES_IN` |
| M-Pesa | `MPESA_ENABLED`, `MPESA_CONSUMER_KEY`, etc. |
| SMS | `SMS_ENABLED`, `AT_API_KEY`, etc. |
| Storage | `STORAGE_PROVIDER`, `AWS_*`, etc. |

See [Configuration Guide](./ref_docs/guides/configuration-guide.md) for complete reference.

---

## Deployment

BodaInsure supports multiple deployment options:

- **Docker Compose** (single server)
- **Kubernetes** (production scale)
- **Cloud Platforms** (AWS, GCP, Azure)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## Documentation

### For Developers

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local development setup |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment |
| [Configuration Guide](./ref_docs/guides/configuration-guide.md) | Environment variables |

### For Users

| Guide | Role |
|-------|------|
| [Rider Guide](./ref_docs/guides/user-guide-rider.md) | Bodaboda riders |
| [SACCO Admin Guide](./ref_docs/guides/user-guide-sacco-admin.md) | SACCO administrators |
| [KBA Admin Guide](./ref_docs/guides/user-guide-kba-admin.md) | KBA administrators |
| [Insurance Admin Guide](./ref_docs/guides/user-guide-insurance-admin.md) | Insurance company |
| [Platform Admin Guide](./ref_docs/guides/user-guide-platform-admin.md) | System administrators |

### Reference Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](./CLAUDE.md) | AI governance and development rules |
| [Product Description](./ref_docs/product_description.md) | Business overview |
| [Module Architecture](./ref_docs/module_architecture.md) | Technical architecture |
| [Requirements Specification](./ref_docs/requirements_specification.md) | Functional requirements |
| [Feature Specification](./ref_docs/feature_specification.md) | Detailed feature specs |

---

## User Roles

| Role | Description | Access |
|------|-------------|--------|
| **Rider** | Bodaboda rider (end user) | Mobile app, USSD |
| **SACCO Admin** | SACCO administrator | Web portal |
| **KBA Admin** | KBA regional coordinator | Web portal |
| **Insurance Admin** | Insurance company staff | Web portal |
| **Platform Admin** | System administrator | Full access |

---

## API Documentation

When running locally, interactive API documentation is available at:

```
http://localhost:3000/docs
```

This provides:
- OpenAPI/Swagger specification
- Interactive endpoint testing
- Request/response schemas
- Authentication support

---

## Testing

### Backend Tests

```bash
# Unit tests
cd src/server
npm test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

### Frontend Tests

```bash
cd src/client
npm test
```

---

## Contributing

1. Follow the branching strategy in [DEVELOPMENT.md](./DEVELOPMENT.md)
2. Adhere to code standards in [CLAUDE.md](./CLAUDE.md)
3. Write tests for new features
4. Update documentation as needed

---

## License

Proprietary - Atronach K Ltd. All rights reserved.

---

## Support

- **Technical Issues**: support@bodainsure.co.ke
- **Business Inquiries**: info@bodainsure.co.ke

---

*Empowering Kenya's bodaboda riders with affordable, accessible insurance.*
