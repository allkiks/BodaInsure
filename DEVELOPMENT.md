# BodaInsure Development Guide

This guide covers local development setup for all BodaInsure platform components:
- **Backend API** (NestJS)
- **Web Portal** (React/Vite)
- **Mobile App** (React Native/Expo)

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Backend Development](#4-backend-development)
5. [Web Portal Development](#5-web-portal-development)
6. [Mobile App Development](#6-mobile-app-development)
7. [Database Setup](#7-database-setup)
8. [API Documentation](#8-api-documentation)
9. [Testing](#9-testing)
10. [Code Style & Linting](#10-code-style--linting)
11. [Git Workflow](#11-git-workflow)
12. [Debugging](#12-debugging)
13. [Common Issues](#13-common-issues)

---

## 1. Quick Start

### One-Command Setup (Docker) - Recommended

The recommended approach is 100% Docker-based development. All services run in containers with hot-reload enabled.

```bash
# Clone repository
git clone https://github.com/your-org/bodainsure.git
cd bodainsure

# Start everything with a single command
make dev-docker

# Windows users (without GNU Make)
dev-docker.cmd start
```

This command will:
1. Build Docker images for frontend and backend
2. Start all infrastructure services (PostgreSQL, Redis, MinIO, MailHog)
3. Run database migrations automatically
4. Start the backend API with hot-reload
5. Start the frontend with hot-reload

**Services Available After Startup:**

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend (Admin) | http://localhost:5173 | - |
| Backend API | http://localhost:3000/api/v1 | - |
| Swagger Docs | http://localhost:3000/docs | - |
| PostgreSQL | localhost:5432 | bodainsure/bodainsure |
| Redis | localhost:6379 | - |
| MinIO Console | http://localhost:9001 | bodainsure/bodainsure123 |
| MailHog (Email) | http://localhost:8025 | - |

**Useful Docker Commands:**

```bash
# View logs
make dev-docker-logs          # All services
make dev-docker-logs-server   # Backend only
make dev-docker-logs-client   # Frontend only

# Restart services
make dev-docker-restart

# Stop services
make dev-docker-down

# Run migrations manually
make dev-migrate

# Open shell in container
make dev-shell-server         # Backend container
make dev-shell-client         # Frontend container
make dev-shell-postgres       # PostgreSQL shell

# Start optional dev tools (pgAdmin, Redis Commander)
make dev-docker-tools

# Clean everything (WARNING: deletes data)
make dev-docker-clean
```

### Manual Setup (Without Docker)

For development without Docker, you'll need to install and run services locally:

```bash
# Backend
cd src/server
npm install
cp .env.example .env
npm run start:dev

# Web Portal (new terminal)
cd src/client
npm install
npm run dev

# Mobile App (new terminal)
cd src/mobile
npm install
npx expo start
```

---

## 2. Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| npm | 10+ | Comes with Node.js |
| PostgreSQL | 15+ | [postgresql.org](https://postgresql.org) or Docker |
| Redis | 7+ | [redis.io](https://redis.io) or Docker |
| Docker | 24+ | [docker.com](https://docker.com) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |

### Mobile Development

| Software | Platform | Installation |
|----------|----------|--------------|
| Expo Go | iOS/Android | App Store / Play Store |
| Android Studio | Android | [developer.android.com](https://developer.android.com/studio) |
| Xcode | iOS (Mac only) | App Store |
| Watchman | macOS | `brew install watchman` |

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "streetsidesoftware.code-spell-checker",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense"
  ]
}
```

---

## 3. Project Structure

```
bodainsure/
├── src/
│   ├── server/                 # NestJS Backend API
│   │   ├── src/
│   │   │   ├── common/         # Shared utilities, guards, filters
│   │   │   ├── config/         # Configuration files
│   │   │   ├── database/       # Migrations, data source
│   │   │   └── modules/        # Feature modules
│   │   │       ├── identity/   # Auth, users, sessions
│   │   │       ├── kyc/        # KYC documents
│   │   │       ├── payment/    # Payments, wallets
│   │   │       ├── policy/     # Insurance policies
│   │   │       ├── organization/ # SACCOs, KBA
│   │   │       ├── notification/ # SMS, WhatsApp, Email
│   │   │       ├── reporting/  # Dashboards, reports
│   │   │       ├── scheduler/  # Cron jobs, batch processing
│   │   │       ├── audit/      # Audit logging
│   │   │       ├── ussd/       # USSD channel
│   │   │       └── queue/      # BullMQ job processing
│   │   ├── test/               # E2E tests
│   │   └── package.json
│   │
│   ├── client/                 # React Web Portal
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── pages/          # Route pages
│   │   │   ├── services/       # API clients
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── lib/            # Utilities
│   │   └── package.json
│   │
│   └── mobile/                 # React Native Mobile App
│       ├── app/                # Expo Router screens
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── services/       # API clients
│       │   ├── store/          # Zustand store
│       │   ├── hooks/          # Custom hooks
│       │   └── i18n/           # Translations
│       └── package.json
│
├── docker/
│   ├── dev/                    # Development Docker config
│   └── prod/                   # Production Docker config
│
├── ref_docs/                   # Reference documentation
│   ├── guides/                 # User and configuration guides
│   ├── product_description.md
│   ├── module_architecture.md
│   ├── requirements_specification.md
│   └── feature_specification.md
├── CLAUDE.md                   # AI governance rules
├── DEPLOYMENT.md               # Deployment guide
├── DEVELOPMENT.md              # This file
└── README.md                   # Project overview
```

---

## 4. Backend Development

### 4.1 Setup

```bash
cd src/server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your local settings (most defaults work)
```

### 4.2 Environment Variables

Key variables for local development (`.env`):

```bash
# Minimal configuration for local dev
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database (use Docker or local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=bodainsure
DB_PASSWORD=bodainsure
DB_NAME=bodainsure
DB_LOGGING=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (dev keys auto-generated if not set)
JWT_SECRET=dev-secret-key

# Disable external services for local dev
MPESA_ENABLED=false
SMS_ENABLED=false
WHATSAPP_ENABLED=false
EMAIL_ENABLED=false
USSD_ENABLED=false
SCHEDULER_ENABLED=false
```

### 4.3 Running the Server

```bash
# Development mode with hot reload
npm run start:dev

# Debug mode (attach debugger)
npm run start:debug

# Production mode (build first)
npm run build
npm run start:prod
```

### 4.4 Database Migrations

```bash
# Show pending migrations
npm run migration:show

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Generate new migration from entity changes
npm run migration:generate -- src/database/migrations/AddNewField

# Create empty migration
npm run migration:create -- src/database/migrations/CustomMigration
```

### 4.5 Creating a New Module

```bash
# Use NestJS CLI
npx nest g module modules/my-module
npx nest g controller modules/my-module/controllers/my-controller
npx nest g service modules/my-module/services/my-service

# Module structure
modules/my-module/
├── controllers/
│   └── my-controller.controller.ts
├── services/
│   └── my-service.service.ts
├── dto/
│   └── create-my-entity.dto.ts
├── entities/
│   └── my-entity.entity.ts
├── interfaces/
│   └── my-interface.interface.ts
└── my-module.module.ts
```

### 4.6 API Endpoints

The API follows RESTful conventions with `/api/v1/` prefix:

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/v1/auth` | Registration, OTP, login |
| Users | `/api/v1/users` | User management |
| KYC | `/api/v1/kyc` | Document upload, status |
| Payments | `/api/v1/payments` | M-Pesa, wallet |
| Policies | `/api/v1/policies` | Policy management |
| Organizations | `/api/v1/organizations` | SACCO/KBA |
| Notifications | `/api/v1/notifications` | SMS, WhatsApp |
| Reports | `/api/v1/reports` | Dashboard data |
| USSD | `/api/v1/ussd` | USSD callbacks |
| Health | `/api/v1/health` | Health check |

---

## 5. Web Portal Development

### 5.1 Setup

```bash
cd src/client

# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:3000/api/v1" > .env.local
```

### 5.2 Running the Development Server

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### 5.3 Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **TypeScript** - Type safety
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Tailwind CSS** - Styling
- **Shadcn/ui** - UI components
- **Recharts** - Charts

### 5.4 Adding New Pages

1. Create page component in `src/pages/`:

```tsx
// src/pages/MyNewPage.tsx
export default function MyNewPage() {
  return (
    <div>
      <h1>My New Page</h1>
    </div>
  );
}
```

2. Add route in `src/router.tsx`:

```tsx
{
  path: '/my-new-page',
  element: <MyNewPage />,
}
```

3. Add to sidebar in `src/components/layout/Sidebar.tsx`:

```tsx
{ name: 'My New Page', href: '/my-new-page', icon: IconComponent }
```

### 5.5 Using the API Client

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { userApi } from '@/services/api/user.api';

// Fetching data
const { data, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: userApi.getUsers,
});

// Mutating data
const mutation = useMutation({
  mutationFn: userApi.createUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});
```

---

## 6. Mobile App Development

### 6.1 Setup

```bash
cd src/mobile

# Install dependencies
npm install

# Install Expo CLI globally (optional)
npm install -g expo-cli
```

### 6.2 Running the App

```bash
# Start Expo dev server
npx expo start

# Options:
# Press 'a' - Open in Android emulator
# Press 'i' - Open in iOS simulator (Mac only)
# Press 'w' - Open in web browser
# Scan QR - Open on physical device with Expo Go
```

### 6.3 Tech Stack

- **React Native 0.74** - Mobile framework
- **Expo SDK 51** - Development platform
- **expo-router** - File-based routing
- **TypeScript** - Type safety
- **TanStack Query** - Server state
- **Zustand** - Client state
- **expo-secure-store** - Secure storage
- **i18next** - Internationalization

### 6.4 Project Structure

```
src/mobile/
├── app/                        # Expo Router screens
│   ├── (auth)/                 # Auth flow screens
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── register.tsx
│   │   └── otp.tsx
│   ├── (tabs)/                 # Main tab screens
│   │   ├── _layout.tsx
│   │   ├── home.tsx
│   │   ├── wallet.tsx
│   │   ├── policy.tsx
│   │   └── profile.tsx
│   ├── kyc.tsx                 # KYC modal
│   ├── payment.tsx             # Payment modal
│   ├── _layout.tsx             # Root layout
│   └── index.tsx               # Entry redirect
├── src/
│   ├── components/ui/          # Reusable UI components
│   ├── services/api/           # API clients
│   ├── store/                  # Zustand store
│   ├── hooks/                  # Custom hooks
│   ├── i18n/                   # Translations
│   │   └── locales/
│   │       ├── en.json         # English
│   │       └── sw.json         # Swahili
│   ├── config/                 # App configuration
│   └── types/                  # TypeScript types
├── app.json                    # Expo config
└── package.json
```

### 6.5 Adding New Screens

1. Create screen file in appropriate directory:

```tsx
// app/(tabs)/new-screen.tsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewScreen() {
  return (
    <SafeAreaView>
      <View>
        <Text>New Screen</Text>
      </View>
    </SafeAreaView>
  );
}
```

2. Add to tab layout if needed (`app/(tabs)/_layout.tsx`):

```tsx
<Tabs.Screen
  name="new-screen"
  options={{
    title: 'New Screen',
    tabBarIcon: ({ color }) => <IconComponent color={color} />,
  }}
/>
```

### 6.6 Testing on Devices

```bash
# Android
npx expo start --android

# iOS (Mac only)
npx expo start --ios

# Physical device
# 1. Install Expo Go on your device
# 2. Scan QR code from terminal
# 3. Ensure device and computer are on same network
```

### 6.7 Building for Preview

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build preview APK (Android)
eas build --platform android --profile preview

# Build development client
eas build --platform android --profile development
```

---

## 7. Database Setup

### 7.1 Using Docker (Recommended)

When using `make dev-docker`, the database is automatically set up and migrations are run. No additional setup is needed.

For infrastructure-only setup:

```bash
# Start only infrastructure services
docker compose -f docker/dev/docker-compose.yml up -d postgres redis minio mailhog

# PostgreSQL: localhost:5432 (bodainsure/bodainsure)
# Redis: localhost:6379
# MinIO: localhost:9000/9001
# MailHog: localhost:8025

# Run migrations manually
make dev-migrate
```

### 7.2 Manual PostgreSQL Setup

```bash
# Create database
createdb bodainsure

# Create user
psql -c "CREATE USER bodainsure WITH PASSWORD 'bodainsure';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE bodainsure TO bodainsure;"

# Run migrations
cd src/server
npm run migration:run
```

### 7.3 Database GUI Tools

- **pgAdmin** - [pgadmin.org](https://pgadmin.org)
- **DBeaver** - [dbeaver.io](https://dbeaver.io)
- **TablePlus** - [tableplus.com](https://tableplus.com)

### 7.4 Seeding Test Data

```bash
# Run seed script (creates test users, organizations, etc.)
cd src/server
npm run seed

# Or manually via psql
psql -h localhost -U bodainsure -d bodainsure -f docker/dev/init-db.sql
```

---

## 8. API Documentation

### 8.1 Swagger UI

When running in development mode, Swagger documentation is available at:

```
http://localhost:3000/docs
```

Features:
- Interactive API explorer
- Request/response schemas
- Try-it-out functionality
- JWT authentication support

### 8.2 OpenAPI Spec

Export OpenAPI specification:

```bash
# JSON format
curl http://localhost:3000/docs-json > openapi.json

# YAML format (requires conversion)
npx swagger-cli bundle openapi.json -o openapi.yaml -t yaml
```

### 8.3 Testing with Swagger

1. Navigate to http://localhost:3000/docs
2. Click "Authorize" button
3. Enter your JWT token: `Bearer <your-token>`
4. Test endpoints using "Try it out"

---

## 9. Testing

### 9.1 Backend Tests

```bash
cd src/server

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e

# Run specific test file
npm test -- --testPathPattern=payment.service.spec.ts
```

### 9.2 Test Structure

```
src/
├── modules/
│   └── payment/
│       ├── services/
│       │   ├── payment.service.ts
│       │   └── payment.service.spec.ts  # Unit test
│       └── controllers/
│           ├── payment.controller.ts
│           └── payment.controller.spec.ts
test/
└── payment.e2e-spec.ts                   # E2E test
```

### 9.3 Writing Tests

```typescript
// Unit test example
describe('PaymentService', () => {
  let service: PaymentService;
  let walletRepo: MockType<Repository<Wallet>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Wallet), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  it('should process deposit payment', async () => {
    const result = await service.processDeposit(userId, 1048);
    expect(result.status).toBe('completed');
  });
});
```

### 9.4 Web Portal Tests

```bash
cd src/client

# Run tests (if configured)
npm test
```

### 9.5 Mobile App Tests

```bash
cd src/mobile

# Run Jest tests
npm test
```

---

## 10. Code Style & Linting

### 10.1 ESLint

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### 10.2 Prettier

```bash
# Format all files
npm run format
```

### 10.3 Configuration Files

- `.eslintrc.js` - ESLint rules
- `.prettierrc` - Prettier rules
- `tsconfig.json` - TypeScript config

### 10.4 Pre-commit Hooks

Install husky for pre-commit hooks:

```bash
npm install husky lint-staged -D
npx husky init
```

`.husky/pre-commit`:
```bash
npm run lint-staged
```

---

## 11. Git Workflow

### 11.1 Branch Naming

```
main           # Production-ready code
develop        # Integration branch
feature/XXX    # New features (e.g., feature/BODA-123-add-kyc)
bugfix/XXX     # Bug fixes
hotfix/XXX     # Urgent production fixes
```

### 11.2 Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]

# Types: feat, fix, docs, style, refactor, test, chore
# Examples:
feat(payment): add M-Pesa B2C refund support
fix(auth): resolve OTP expiration race condition
docs(readme): update installation instructions
```

### 11.3 Pull Request Process

1. Create feature branch from `develop`
2. Make changes with descriptive commits
3. Push and create PR to `develop`
4. Request code review
5. Address review comments
6. Squash and merge after approval

---

## 12. Debugging

### 12.1 Backend Debugging

**VS Code Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to NestJS",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

Start with debug mode:
```bash
npm run start:debug
```

### 12.2 Database Queries

Enable query logging:
```bash
DB_LOGGING=true
```

### 12.3 Network Requests

Use browser DevTools or:
- **Postman** - API testing
- **Insomnia** - API client
- **curl** - Command line

### 12.4 Mobile Debugging

```bash
# React Native Debugger
npx expo start --dev-client

# Flipper (advanced)
# https://fbflipper.com/
```

---

## 13. Common Issues

### Issue: Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

### Issue: Database Connection Failed

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection
psql -h localhost -U bodainsure -d bodainsure

# Reset database
npm run schema:drop
npm run migration:run
```

### Issue: Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript Errors

```bash
# Clean build cache
rm -rf dist
npm run build
```

### Issue: Expo Build Fails

```bash
# Clear Expo cache
npx expo start --clear

# Reset Metro bundler
npx expo start -c
```

### Issue: Redis Connection Refused

```bash
# Start Redis via Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or disable Redis features
REDIS_HOST=
```

---

## Quick Reference

### Docker Commands (Recommended)

| Command | Description |
|---------|-------------|
| `make dev-docker` | Start full Docker environment |
| `make dev-docker-down` | Stop all services |
| `make dev-docker-logs` | View all logs (follow mode) |
| `make dev-docker-restart` | Restart all services |
| `make dev-docker-clean` | Remove all containers and volumes |
| `make dev-docker-tools` | Start pgAdmin & Redis Commander |
| `make dev-migrate` | Run database migrations |
| `make dev-shell-server` | Open server container shell |
| `make dev-shell-client` | Open client container shell |
| `make dev-shell-postgres` | Open PostgreSQL shell |
| `make dev-status` | Show container status |
| `make dev-test` | Run server tests |
| `make dev-lint` | Run linting |

**Windows users**: Use `dev-docker.cmd` instead of `make`:
- `dev-docker.cmd start` - Start environment
- `dev-docker.cmd stop` - Stop services
- `dev-docker.cmd logs` - View logs
- `dev-docker.cmd migrate` - Run migrations

### Backend Commands (Manual Setup)

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start with hot reload |
| `npm run start:debug` | Start with debugger |
| `npm run build` | Build for production |
| `npm run test` | Run tests |
| `npm run lint` | Run linter |
| `npm run migration:run` | Run migrations |
| `npm run migration:generate` | Generate migration |

### Web Portal Commands (Manual Setup)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview build |
| `npm run lint` | Run linter |

### Mobile App Commands

| Command | Description |
|---------|-------------|
| `npx expo start` | Start Expo dev server |
| `npx expo start --android` | Start with Android |
| `npx expo start --ios` | Start with iOS |
| `npx expo start --clear` | Clear cache |
| `eas build` | Build with EAS |

---

*Last updated: December 2024*
