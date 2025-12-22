# Azure App Service Deployment Guide (Native - Without Docker)

This guide covers deploying the BodaInsure platform to Azure App Service **without Docker**, using native Node.js runtime for the server and Azure Static Web Apps for the client.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Azure Resources Setup](#3-azure-resources-setup)
4. [Server Deployment](#4-server-deployment)
5. [Client Deployment](#5-client-deployment)
6. [Database & Redis Setup](#6-database--redis-setup)
7. [Environment Configuration](#7-environment-configuration)
8. [CI/CD Pipeline Setup](#8-cicd-pipeline-setup)
9. [SSL & Custom Domain](#9-ssl--custom-domain)
10. [Monitoring & Logging](#10-monitoring--logging)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Architecture Overview

```
                                    ┌─────────────────────────┐
                                    │  Azure Static Web Apps  │
                                    │    (React Client)       │
                                    │  admin.bodainsure.co.ke │
                                    └───────────┬─────────────┘
                                                │
┌─────────────────┐                             │
│   Mobile App    │                             │
│   (iOS/Android) │─────────┐                   │
└─────────────────┘         │                   │
                            ▼                   ▼
                    ┌───────────────────────────────────┐
                    │      Azure App Service (Linux)    │
                    │         NestJS API Server         │
                    │      api.bodainsure.co.ke         │
                    └───────────────┬───────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │ Azure Database│       │  Azure Cache  │       │ Azure Blob    │
    │ for PostgreSQL│       │   for Redis   │       │   Storage     │
    └───────────────┘       └───────────────┘       └───────────────┘
```

### Components

| Component | Azure Service | SKU (Production) |
|-----------|---------------|------------------|
| API Server | App Service (Linux) | P1v3 or higher |
| Web Client | Static Web Apps | Standard |
| Database | Azure Database for PostgreSQL | Flexible Server (GP) |
| Cache | Azure Cache for Redis | Basic C1 or Standard |
| Storage | Azure Blob Storage | Standard LRS |
| Secrets | Azure Key Vault | Standard |

---

## 2. Prerequisites

### Required Tools

```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
# or on Windows: winget install Microsoft.AzureCLI

# Verify installation
az --version

# Login to Azure
az login

# Set default subscription
az account set --subscription "Your-Subscription-Name"
```

### Required Azure Permissions

- Contributor role on the resource group
- Key Vault access policies (if using Key Vault)

### Required Information

- Azure Subscription ID
- Desired resource group name
- Target Azure region (e.g., `southafricanorth` for Kenya proximity)

---

## 3. Azure Resources Setup

### 3.1 Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="rg-bodainsure-prod"
LOCATION="southafricanorth"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags Environment=Production Project=BodaInsure
```

### 3.2 Create App Service Plan

```bash
# Create Linux App Service Plan
az appservice plan create \
  --name "asp-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku P1v3 \
  --is-linux
```

### 3.3 Create Web App for API

```bash
# Create App Service for API (Node.js 20)
az webapp create \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --plan "asp-bodainsure-prod" \
  --runtime "NODE:20-lts"

# Configure startup command
az webapp config set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --startup-file "node dist/main.js"

# Enable always-on (prevents cold starts)
az webapp config set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --always-on true
```

### 3.4 Create Static Web App for Client

```bash
# Create Static Web App (via Azure Portal or CLI)
az staticwebapp create \
  --name "swa-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard
```

---

## 4. Server Deployment

### 4.1 Prepare Server for Deployment

Ensure your `src/server/package.json` has the correct scripts:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:prod": "node dist/main.js"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 4.2 Configure Deployment Settings

```bash
# Set Node.js version
az webapp config set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --linux-fx-version "NODE|20-lts"

# Configure app settings (environment variables)
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    WEBSITE_NODE_DEFAULT_VERSION=~20
```

### 4.3 Deploy via ZIP Deploy

```bash
cd src/server

# Install dependencies and build
npm ci --production=false
npm run build

# Create deployment package
zip -r deploy.zip dist package.json package-lock.json node_modules

# Deploy
az webapp deploy \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --src-path deploy.zip \
  --type zip
```

### 4.4 Configure Health Check

```bash
az webapp config set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --generic-configurations '{"healthCheckPath": "/api/v1/health"}'
```

---

## 5. Client Deployment

### 5.1 Prepare Client for Deployment

Create `src/client/staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.js", "/*.css", "/*.ico", "/*.svg"]
  },
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://app-bodainsure-api-prod.azurewebsites.net/api/*"
    }
  ],
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  },
  "globalHeaders": {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://app-bodainsure-api-prod.azurewebsites.net"
  }
}
```

### 5.2 Build and Deploy

```bash
cd src/client

# Install dependencies
npm ci

# Build with production environment
VITE_API_URL=https://app-bodainsure-api-prod.azurewebsites.net/api/v1 npm run build

# Deploy via SWA CLI
npm install -g @azure/static-web-apps-cli
swa deploy ./dist \
  --deployment-token $SWA_DEPLOYMENT_TOKEN \
  --env production
```

---

## 6. Database & Redis Setup

### 6.1 Create PostgreSQL Server

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --name "psql-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user bodainsure_admin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_D2s_v3 \
  --storage-size 128 \
  --version 15 \
  --high-availability Enabled

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name "psql-bodainsure-prod" \
  --database-name bodainsure

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name "psql-bodainsure-prod" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 6.2 Create Redis Cache

```bash
# Create Redis Cache
az redis create \
  --name "redis-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard \
  --vm-size C1 \
  --enable-non-ssl-port false

# Get connection string
az redis list-keys \
  --name "redis-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP
```

### 6.3 Create Blob Storage

```bash
# Create storage account
az storage account create \
  --name "stbodainsuredocs" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Create containers
az storage container create \
  --name kyc-documents \
  --account-name "stbodainsuredocs" \
  --auth-mode login

az storage container create \
  --name policy-documents \
  --account-name "stbodainsuredocs" \
  --auth-mode login
```

---

## 7. Environment Configuration

### 7.1 Configure App Settings

```bash
# Get database connection string
DB_HOST="psql-bodainsure-prod.postgres.database.azure.com"

# Get Redis connection string
REDIS_HOST="redis-bodainsure-prod.redis.cache.windows.net"
REDIS_KEY=$(az redis list-keys --name "redis-bodainsure-prod" --resource-group $RESOURCE_GROUP --query primaryKey -o tsv)

# Get Storage connection string
STORAGE_KEY=$(az storage account keys list --account-name "stbodainsuredocs" --resource-group $RESOURCE_GROUP --query '[0].value' -o tsv)

# Set all environment variables
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    API_PREFIX=api/v1 \
    DB_HOST=$DB_HOST \
    DB_PORT=5432 \
    DB_USERNAME=bodainsure_admin \
    DB_PASSWORD="YourSecurePassword123!" \
    DB_NAME=bodainsure \
    DB_SSL=true \
    REDIS_HOST=$REDIS_HOST \
    REDIS_PORT=6380 \
    REDIS_PASSWORD=$REDIS_KEY \
    REDIS_TLS=true \
    JWT_SECRET="your-production-jwt-secret-min-64-chars" \
    ENCRYPTION_KEY="your-32-byte-encryption-key" \
    STORAGE_PROVIDER=azure \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=stbodainsuredocs;AccountKey=$STORAGE_KEY;EndpointSuffix=core.windows.net" \
    CORS_ORIGIN="https://swa-bodainsure-admin-prod.azurestaticapps.net"
```

### 7.2 Using Azure Key Vault (Recommended)

```bash
# Create Key Vault
az keyvault create \
  --name "kv-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Add secrets
az keyvault secret set --vault-name "kv-bodainsure-prod" --name "DB-PASSWORD" --value "YourSecurePassword123!"
az keyvault secret set --vault-name "kv-bodainsure-prod" --name "JWT-SECRET" --value "your-production-jwt-secret"
az keyvault secret set --vault-name "kv-bodainsure-prod" --name "ENCRYPTION-KEY" --value "your-encryption-key"
az keyvault secret set --vault-name "kv-bodainsure-prod" --name "REDIS-PASSWORD" --value "$REDIS_KEY"

# Enable managed identity for App Service
az webapp identity assign \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP

# Get principal ID
PRINCIPAL_ID=$(az webapp identity show --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name "kv-bodainsure-prod" \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list

# Reference Key Vault secrets in app settings
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings \
    DB_PASSWORD="@Microsoft.KeyVault(VaultName=kv-bodainsure-prod;SecretName=DB-PASSWORD)" \
    JWT_SECRET="@Microsoft.KeyVault(VaultName=kv-bodainsure-prod;SecretName=JWT-SECRET)" \
    ENCRYPTION_KEY="@Microsoft.KeyVault(VaultName=kv-bodainsure-prod;SecretName=ENCRYPTION-KEY)"
```

---

## 8. CI/CD Pipeline Setup

### 8.1 GitHub Actions Workflow

The deployment workflows are located in:

- **Development**: `docker/azure/azure_appservice_native_dev.yml`
- **Production**: `docker/azure/azure_appservice_native_prod.yml`

Copy these to `.github/workflows/` in your repository.

### 8.2 Required GitHub Secrets

Configure these secrets in your GitHub repository:

| Secret Name | Description |
|-------------|-------------|
| `AZURE_CREDENTIALS` | Azure service principal JSON |
| `AZURE_WEBAPP_PUBLISH_PROFILE_DEV` | Publish profile for dev App Service |
| `AZURE_WEBAPP_PUBLISH_PROFILE_PROD` | Publish profile for prod App Service |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV` | SWA deployment token (dev) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD` | SWA deployment token (prod) |

### 8.3 Create Azure Service Principal

```bash
# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "sp-bodainsure-github" \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth

# Copy the JSON output to AZURE_CREDENTIALS secret
```

### 8.4 Get Publish Profile

```bash
# Download publish profile
az webapp deployment list-publishing-profiles \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --xml
```

---

## 9. SSL & Custom Domain

### 9.1 Configure Custom Domain for API

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --hostname api.bodainsure.co.ke

# Create managed certificate
az webapp config ssl create \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --hostname api.bodainsure.co.ke

# Bind certificate
az webapp config ssl bind \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --certificate-thumbprint $CERT_THUMBPRINT \
  --ssl-type SNI

# Enforce HTTPS
az webapp update \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --https-only true
```

### 9.2 Configure Custom Domain for Client

In Azure Portal or CLI, add custom domain to Static Web App:

```bash
az staticwebapp hostname set \
  --name "swa-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --hostname admin.bodainsure.co.ke
```

### 9.3 DNS Configuration

Add these DNS records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| CNAME | api | app-bodainsure-api-prod.azurewebsites.net |
| CNAME | admin | swa-bodainsure-admin-prod.azurestaticapps.net |
| TXT | asuid.api | (verification token from Azure) |
| TXT | asuid.admin | (verification token from Azure) |

---

## 10. Monitoring & Logging

### 10.1 Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app "ai-bodainsure-prod" \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type Node.JS

# Get instrumentation key
APPINSIGHTS_KEY=$(az monitor app-insights component show \
  --app "ai-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv)

# Configure App Service
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings \
    APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=$APPINSIGHTS_KEY" \
    ApplicationInsightsAgent_EXTENSION_VERSION="~3"
```

### 10.2 Enable Diagnostic Logs

```bash
# Enable application logging
az webapp log config \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --application-logging filesystem \
  --level information \
  --web-server-logging filesystem

# Stream logs
az webapp log tail \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP
```

### 10.3 Set Up Alerts

```bash
# Create action group for alerts
az monitor action-group create \
  --name "ag-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --short-name "BodaInsure" \
  --action email admin admin@bodainsure.co.ke

# Create alert for high CPU
az monitor metrics alert create \
  --name "alert-high-cpu" \
  --resource-group $RESOURCE_GROUP \
  --scopes /subscriptions/{sub-id}/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/app-bodainsure-api-prod \
  --condition "avg Percentage CPU > 80" \
  --window-size 5m \
  --action ag-bodainsure-prod
```

---

## 11. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 503 Service Unavailable | App not started | Check startup logs, verify startup command |
| Database connection failed | SSL/Firewall | Enable SSL, check firewall rules |
| Redis connection timeout | TLS required | Set `REDIS_TLS=true`, use port 6380 |
| Static files 404 | Wrong build config | Verify `staticwebapp.config.json` |
| CORS errors | Missing origin | Add client URL to `CORS_ORIGIN` |

### Debug Commands

```bash
# View app logs
az webapp log tail --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP

# SSH into app container
az webapp ssh --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP

# Check app status
az webapp show --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP --query state

# Restart app
az webapp restart --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP

# View deployment logs
az webapp log deployment show --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP
```

### Health Check Debugging

```bash
# Test health endpoint
curl https://app-bodainsure-api-prod.azurewebsites.net/api/v1/health

# Check database connectivity from app
az webapp ssh --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP
# Inside container:
node -e "const { Client } = require('pg'); const c = new Client({connectionString: process.env.DATABASE_URL}); c.connect().then(() => console.log('Connected!')).catch(e => console.error(e));"
```

---

## Quick Reference

### Azure CLI Commands

| Command | Description |
|---------|-------------|
| `az webapp list -g $RESOURCE_GROUP` | List web apps |
| `az webapp restart -n $APP_NAME -g $RESOURCE_GROUP` | Restart app |
| `az webapp log tail -n $APP_NAME -g $RESOURCE_GROUP` | Stream logs |
| `az webapp config appsettings list -n $APP_NAME -g $RESOURCE_GROUP` | List settings |
| `az webapp deployment slot list -n $APP_NAME -g $RESOURCE_GROUP` | List slots |

### Resource Naming Convention

| Resource | Name Pattern | Example |
|----------|--------------|---------|
| Resource Group | `rg-{project}-{env}` | `rg-bodainsure-prod` |
| App Service Plan | `asp-{project}-{env}` | `asp-bodainsure-prod` |
| Web App | `app-{project}-{component}-{env}` | `app-bodainsure-api-prod` |
| Static Web App | `swa-{project}-{component}-{env}` | `swa-bodainsure-admin-prod` |
| PostgreSQL | `psql-{project}-{env}` | `psql-bodainsure-prod` |
| Redis | `redis-{project}-{env}` | `redis-bodainsure-prod` |
| Storage | `st{project}{purpose}` | `stbodainsuredocs` |
| Key Vault | `kv-{project}-{env}` | `kv-bodainsure-prod` |

---

*Last updated: December 2024*
