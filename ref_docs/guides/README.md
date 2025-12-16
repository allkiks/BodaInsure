# BodaInsure Documentation Guides

This directory contains user guides and configuration documentation for the BodaInsure platform.

## User Guides by Role

| Role | Guide | Description |
|------|-------|-------------|
| **Bodaboda Rider** | [user-guide-rider.md](./user-guide-rider.md) | End-user guide for riders using the mobile app and USSD |
| **SACCO Admin** | [user-guide-sacco-admin.md](./user-guide-sacco-admin.md) | Guide for SACCO administrators managing members |
| **KBA Admin** | [user-guide-kba-admin.md](./user-guide-kba-admin.md) | Guide for Kenya Bodaboda Association regional admins |
| **Insurance Admin** | [user-guide-insurance-admin.md](./user-guide-insurance-admin.md) | Guide for insurance company administrators |
| **Platform Admin** | [user-guide-platform-admin.md](./user-guide-platform-admin.md) | System administration guide |

## Configuration Guide

| Document | Description |
|----------|-------------|
| [configuration-guide.md](./configuration-guide.md) | Complete environment variable reference and configuration options |

## Role Hierarchy

```
Platform Admin (Atronach K Ltd)
    │
    ├── Insurance Admin (Robs Insurance / Definite Assurance)
    │
    └── KBA Admin (Kenya Bodaboda Association)
            │
            └── SACCO Admin (Local SACCOs)
                    │
                    └── Rider (Bodaboda Riders)
```

## Quick Links

### For Developers
- [DEVELOPMENT.md](../../DEVELOPMENT.md) - Local development setup
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Production deployment guide
- [configuration-guide.md](./configuration-guide.md) - Environment variables

### For Business Users
- [Product Description](../product_description.md) - Business overview
- [Feature Specification](../feature_specification.md) - Detailed feature specs

### For Architects
- [Module Architecture](../module_architecture.md) - System architecture
- [Requirements Specification](../requirements_specification.md) - Technical requirements

---

*Last Updated: December 2024*
