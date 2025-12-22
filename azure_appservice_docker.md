# Azure App Service Deployment Guide (Docker)

This guide covers deploying the BodaInsure platform to Azure App Service **using Docker containers**, with Azure Container Registry for image storage.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Azure Resources Setup](#3-azure-resources-setup)
4. [Docker Images Preparation](#4-docker-images-preparation)
5. [Container Registry Setup](#5-container-registry-setup)
6. [Server Deployment](#6-server-deployment)
7. [Client Deployment](#7-client-deployment)
8. [Database & Redis Setup](#8-database--redis-setup)
9. [Environment Configuration](#9-environment-configuration)
10. [CI/CD Pipeline Setup](#10-cicd-pipeline-setup)
11. [Multi-Container Deployment](#11-multi-container-deployment)
12. [SSL & Custom Domain](#12-ssl--custom-domain)
13. [Monitoring & Logging](#13-monitoring--logging)
14. [Scaling & Performance](#14-scaling--performance)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

```
                                    ┌─────────────────────────┐
                                    │  Azure App Service      │
                                    │  (Docker - Nginx)       │
                                    │  React Client           │
                                    │  admin.bodainsure.co.ke │
                                    └───────────┬─────────────┘
                                                │
┌─────────────────┐                             │
│   Mobile App    │                             │
│   (iOS/Android) │─────────┐                   │
└─────────────────┘         │                   │
                            ▼                   ▼
                    ┌───────────────────────────────────┐
                    │      Azure App Service (Docker)   │
                    │         NestJS API Container      │
                    │      api.bodainsure.co.ke         │
                    └───────────────┬───────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │               ┌───────────────┴───────────────┐               │
    ▼               ▼                               ▼               ▼
┌─────────┐ ┌───────────────┐               ┌───────────────┐ ┌─────────────┐
│  Azure  │ │ Azure Database│               │  Azure Cache  │ │ Azure Blob  │
│   ACR   │ │ for PostgreSQL│               │   for Redis   │ │   Storage   │
└─────────┘ └───────────────┘               └───────────────┘ └─────────────┘
```

### Components

| Component | Azure Service | SKU (Production) |
|-----------|---------------|------------------|
| Container Registry | Azure Container Registry | Basic or Standard |
| API Server | App Service for Containers | P1v3 or higher |
| Web Client | App Service for Containers | B1 or higher |
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

# Docker
curl -fsSL https://get.docker.com | sh

# Verify installations
az --version
docker --version

# Login to Azure
az login
az account set --subscription "Your-Subscription-Name"
```

### Docker Desktop (Windows/Mac)

Download from [docker.com](https://www.docker.com/products/docker-desktop/)

---

## 3. Azure Resources Setup

### 3.1 Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="rg-bodainsure-prod"
LOCATION="southafricanorth"
ACR_NAME="acrbodainsure"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags Environment=Production Project=BodaInsure
```

### 3.2 Create Container Registry

```bash
# Create Azure Container Registry
az acr create \
  --name $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard \
  --admin-enabled true

# Get ACR credentials
az acr credential show --name $ACR_NAME

# Login to ACR
az acr login --name $ACR_NAME
```

### 3.3 Create App Service Plan

```bash
# Create Linux App Service Plan for containers
az appservice plan create \
  --name "asp-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku P1v3 \
  --is-linux
```

---

## 4. Docker Images Preparation

### 4.1 Server Dockerfile (Production)

The production Dockerfile is located at `docker/prod/Dockerfile`:

```dockerfile
# docker/prod/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start application
CMD ["node", "dist/main.js"]
```

### 4.2 Client Dockerfile (Production)

Create `docker/prod/Dockerfile.client`:

```dockerfile
# docker/prod/Dockerfile.client
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment
ARG VITE_API_URL
ARG VITE_APP_NAME=BodaInsure Admin

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

# Build application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy nginx configuration
COPY docker/prod/nginx-client.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN adduser -D -H -u 1001 -s /sbin/nologin nginx-user && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

USER nginx-user

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 4.3 Nginx Configuration for Client

Create `docker/prod/nginx-client.conf`:

```nginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml application/xml+rss text/javascript application/x-javascript;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # SPA routing - serve index.html for all routes
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Don't cache HTML
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### 4.4 Build and Push Images

```bash
# Build and tag server image
cd src/server
docker build -f ../../docker/prod/Dockerfile -t $ACR_NAME.azurecr.io/bodainsure-api:latest .
docker build -f ../../docker/prod/Dockerfile -t $ACR_NAME.azurecr.io/bodainsure-api:$(git rev-parse --short HEAD) .

# Build and tag client image
cd ../client
docker build -f ../../docker/prod/Dockerfile.client \
  --build-arg VITE_API_URL=https://api.bodainsure.co.ke/api/v1 \
  -t $ACR_NAME.azurecr.io/bodainsure-admin:latest .
docker build -f ../../docker/prod/Dockerfile.client \
  --build-arg VITE_API_URL=https://api.bodainsure.co.ke/api/v1 \
  -t $ACR_NAME.azurecr.io/bodainsure-admin:$(git rev-parse --short HEAD) .

# Push to ACR
docker push $ACR_NAME.azurecr.io/bodainsure-api:latest
docker push $ACR_NAME.azurecr.io/bodainsure-api:$(git rev-parse --short HEAD)
docker push $ACR_NAME.azurecr.io/bodainsure-admin:latest
docker push $ACR_NAME.azurecr.io/bodainsure-admin:$(git rev-parse --short HEAD)
```

---

## 5. Container Registry Setup

### 5.1 Configure ACR Authentication

```bash
# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Store in Key Vault (recommended)
az keyvault secret set --vault-name "kv-bodainsure-prod" --name "ACR-USERNAME" --value $ACR_USERNAME
az keyvault secret set --vault-name "kv-bodainsure-prod" --name "ACR-PASSWORD" --value $ACR_PASSWORD
```

### 5.2 Enable Managed Identity (Recommended)

```bash
# Create managed identity for ACR access
az identity create \
  --name "id-bodainsure-acr" \
  --resource-group $RESOURCE_GROUP

# Get identity details
IDENTITY_ID=$(az identity show --name "id-bodainsure-acr" --resource-group $RESOURCE_GROUP --query id -o tsv)
PRINCIPAL_ID=$(az identity show --name "id-bodainsure-acr" --resource-group $RESOURCE_GROUP --query principalId -o tsv)

# Grant AcrPull role to identity
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --scope $ACR_ID \
  --role AcrPull
```

---

## 6. Server Deployment

### 6.1 Create Web App for API

```bash
# Create App Service for container
az webapp create \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --plan "asp-bodainsure-prod" \
  --deployment-container-image-name "$ACR_NAME.azurecr.io/bodainsure-api:latest"

# Configure container registry authentication
az webapp config container set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name "$ACR_NAME.azurecr.io/bodainsure-api:latest" \
  --docker-registry-server-url "https://$ACR_NAME.azurecr.io" \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

# Or use managed identity (recommended)
az webapp config container set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name "$ACR_NAME.azurecr.io/bodainsure-api:latest" \
  --docker-registry-server-url "https://$ACR_NAME.azurecr.io"

az webapp identity assign \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --identities $IDENTITY_ID
```

### 6.2 Configure Container Settings

```bash
# Set container port
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings WEBSITES_PORT=3000

# Enable continuous deployment from ACR
az webapp deployment container config \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --enable-cd true

# Configure always-on
az webapp config set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --always-on true
```

### 6.3 Configure Health Check

```bash
az webapp config set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --generic-configurations '{"healthCheckPath": "/api/v1/health"}'
```

---

## 7. Client Deployment

### 7.1 Create Web App for Client

```bash
# Create separate App Service for client (or use same plan)
az webapp create \
  --name "app-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --plan "asp-bodainsure-prod" \
  --deployment-container-image-name "$ACR_NAME.azurecr.io/bodainsure-admin:latest"

# Configure container registry
az webapp config container set \
  --name "app-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name "$ACR_NAME.azurecr.io/bodainsure-admin:latest" \
  --docker-registry-server-url "https://$ACR_NAME.azurecr.io" \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD

# Set container port
az webapp config appsettings set \
  --name "app-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings WEBSITES_PORT=80
```

---

## 8. Database & Redis Setup

### 8.1 Create PostgreSQL Server

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

# Configure firewall for Azure services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name "psql-bodainsure-prod" \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 8.2 Create Redis Cache

```bash
# Create Redis Cache
az redis create \
  --name "redis-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard \
  --vm-size C1 \
  --enable-non-ssl-port false

# Get connection details
az redis show \
  --name "redis-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --query hostName -o tsv

az redis list-keys \
  --name "redis-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP
```

### 8.3 Create Blob Storage

```bash
# Create storage account
az storage account create \
  --name "stbodainsuredocs" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Create containers
az storage container create --name kyc-documents --account-name "stbodainsuredocs"
az storage container create --name policy-documents --account-name "stbodainsuredocs"
az storage container create --name claim-documents --account-name "stbodainsuredocs"
```

---

## 9. Environment Configuration

### 9.1 Configure App Settings

```bash
# Get connection details
DB_HOST="psql-bodainsure-prod.postgres.database.azure.com"
REDIS_HOST="redis-bodainsure-prod.redis.cache.windows.net"
REDIS_KEY=$(az redis list-keys --name "redis-bodainsure-prod" --resource-group $RESOURCE_GROUP --query primaryKey -o tsv)
STORAGE_KEY=$(az storage account keys list --account-name "stbodainsuredocs" --resource-group $RESOURCE_GROUP --query '[0].value' -o tsv)

# Set all environment variables for API
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
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
    JWT_EXPIRES_IN=30d \
    ENCRYPTION_KEY="your-32-byte-encryption-key" \
    STORAGE_PROVIDER=azure \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=stbodainsuredocs;AccountKey=$STORAGE_KEY;EndpointSuffix=core.windows.net" \
    CORS_ORIGIN="https://app-bodainsure-admin-prod.azurewebsites.net,https://admin.bodainsure.co.ke"
```

### 9.2 Using Azure Key Vault

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

# Enable managed identity
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

# Reference secrets in app settings
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings \
    DB_PASSWORD="@Microsoft.KeyVault(VaultName=kv-bodainsure-prod;SecretName=DB-PASSWORD)" \
    JWT_SECRET="@Microsoft.KeyVault(VaultName=kv-bodainsure-prod;SecretName=JWT-SECRET)" \
    ENCRYPTION_KEY="@Microsoft.KeyVault(VaultName=kv-bodainsure-prod;SecretName=ENCRYPTION-KEY)"
```

---

## 10. CI/CD Pipeline Setup

### 10.1 GitHub Actions Workflow

The deployment workflows are located in:

- **Development**: `docker/azure/azure_appservice_docker_dev.yml`
- **Production**: `docker/azure/azure_appservice_docker_prod.yml`

Copy these to `.github/workflows/` in your repository.

### 10.2 Required GitHub Secrets

| Secret Name | Description |
|-------------|-------------|
| `AZURE_CREDENTIALS` | Azure service principal JSON |
| `ACR_LOGIN_SERVER` | e.g., `acrbodainsure.azurecr.io` |
| `ACR_USERNAME` | ACR admin username |
| `ACR_PASSWORD` | ACR admin password |
| `AZURE_WEBAPP_NAME_API_DEV` | Dev API App Service name |
| `AZURE_WEBAPP_NAME_API_PROD` | Prod API App Service name |
| `AZURE_WEBAPP_NAME_CLIENT_DEV` | Dev Client App Service name |
| `AZURE_WEBAPP_NAME_CLIENT_PROD` | Prod Client App Service name |
| `VITE_API_URL_DEV` | Dev API URL |
| `VITE_API_URL_PROD` | Prod API URL |

### 10.3 Create Azure Service Principal

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "sp-bodainsure-github" \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth

# Output JSON to AZURE_CREDENTIALS secret
```

### 10.4 Configure ACR Webhook for Continuous Deployment

```bash
# Get webhook URL from App Service
WEBHOOK_URL=$(az webapp deployment container show-cd-url \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --query CI_CD_URL -o tsv)

# Create ACR webhook
az acr webhook create \
  --name webhookBodainsureApi \
  --registry $ACR_NAME \
  --resource-group $RESOURCE_GROUP \
  --actions push \
  --scope bodainsure-api:latest \
  --uri $WEBHOOK_URL
```

---

## 11. Multi-Container Deployment

### 11.1 Docker Compose for Azure

Create `docker/azure/docker-compose.azure.yml`:

```yaml
version: '3.8'

services:
  api:
    image: ${ACR_NAME}.azurecr.io/bodainsure-api:${TAG:-latest}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  admin:
    image: ${ACR_NAME}.azurecr.io/bodainsure-admin:${TAG:-latest}
    ports:
      - "80:80"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 11.2 Deploy Multi-Container App

```bash
# Create multi-container web app
az webapp create \
  --name "app-bodainsure-multi-prod" \
  --resource-group $RESOURCE_GROUP \
  --plan "asp-bodainsure-prod" \
  --multicontainer-config-type compose \
  --multicontainer-config-file docker/azure/docker-compose.azure.yml

# Configure registry authentication
az webapp config container set \
  --name "app-bodainsure-multi-prod" \
  --resource-group $RESOURCE_GROUP \
  --multicontainer-config-type compose \
  --multicontainer-config-file docker/azure/docker-compose.azure.yml \
  --docker-registry-server-url "https://$ACR_NAME.azurecr.io" \
  --docker-registry-server-user $ACR_USERNAME \
  --docker-registry-server-password $ACR_PASSWORD
```

---

## 12. SSL & Custom Domain

### 12.1 Configure Custom Domain for API

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
CERT_THUMBPRINT=$(az webapp config ssl list --resource-group $RESOURCE_GROUP --query "[?name=='api.bodainsure.co.ke'].thumbprint" -o tsv)
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

### 12.2 Configure Custom Domain for Client

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name "app-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --hostname admin.bodainsure.co.ke

# Create and bind certificate
az webapp config ssl create \
  --name "app-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --hostname admin.bodainsure.co.ke

# Enforce HTTPS
az webapp update \
  --name "app-bodainsure-admin-prod" \
  --resource-group $RESOURCE_GROUP \
  --https-only true
```

### 12.3 DNS Configuration

| Type | Name | Value |
|------|------|-------|
| CNAME | api | app-bodainsure-api-prod.azurewebsites.net |
| CNAME | admin | app-bodainsure-admin-prod.azurewebsites.net |
| TXT | asuid.api | (verification token from Azure) |
| TXT | asuid.admin | (verification token from Azure) |

---

## 13. Monitoring & Logging

### 13.1 Enable Container Logging

```bash
# Enable logging
az webapp log config \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --docker-container-logging filesystem

# Stream logs
az webapp log tail \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP
```

### 13.2 Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app "ai-bodainsure-prod" \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type Node.JS

# Get connection string
APPINSIGHTS_CS=$(az monitor app-insights component show \
  --app "ai-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Configure App Service
az webapp config appsettings set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$APPINSIGHTS_CS"
```

### 13.3 View Container Logs

```bash
# View recent logs
az webapp log download \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --log-file logs.zip

# View in Azure Portal
# Navigate to: App Service > Deployment Center > Logs
```

---

## 14. Scaling & Performance

### 14.1 Manual Scaling

```bash
# Scale up (change SKU)
az appservice plan update \
  --name "asp-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --sku P2v3

# Scale out (add instances)
az appservice plan update \
  --name "asp-bodainsure-prod" \
  --resource-group $RESOURCE_GROUP \
  --number-of-workers 3
```

### 14.2 Auto-Scaling

```bash
# Create autoscale settings
az monitor autoscale create \
  --resource-group $RESOURCE_GROUP \
  --resource "asp-bodainsure-prod" \
  --resource-type Microsoft.Web/serverfarms \
  --name "autoscale-bodainsure" \
  --min-count 2 \
  --max-count 10 \
  --count 2

# Add CPU-based rule
az monitor autoscale rule create \
  --resource-group $RESOURCE_GROUP \
  --autoscale-name "autoscale-bodainsure" \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1

az monitor autoscale rule create \
  --resource-group $RESOURCE_GROUP \
  --autoscale-name "autoscale-bodainsure" \
  --condition "Percentage CPU < 30 avg 5m" \
  --scale in 1
```

### 14.3 Deployment Slots

```bash
# Create staging slot
az webapp deployment slot create \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --slot staging

# Deploy to staging
az webapp config container set \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --slot staging \
  --docker-custom-image-name "$ACR_NAME.azurecr.io/bodainsure-api:$NEW_VERSION"

# Swap slots (zero-downtime deployment)
az webapp deployment slot swap \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP \
  --slot staging \
  --target-slot production
```

---

## 15. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Container fails to start | Image pull error | Verify ACR credentials, check image exists |
| 502 Bad Gateway | Container crashed | Check container logs, verify PORT setting |
| Database connection failed | SSL/Firewall | Enable SSL, check firewall rules |
| High memory usage | Memory leak | Set memory limits, restart container |
| Slow cold starts | Large image | Optimize Dockerfile, use multi-stage builds |

### Debug Commands

```bash
# View container logs
az webapp log tail --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP

# Check container status
az webapp show --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP --query state

# Restart container
az webapp restart --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP

# SSH into container
az webapp create-remote-connection \
  --name "app-bodainsure-api-prod" \
  --resource-group $RESOURCE_GROUP

# Check image details
az acr repository show-tags --name $ACR_NAME --repository bodainsure-api

# View deployment logs
az webapp log deployment show --name "app-bodainsure-api-prod" --resource-group $RESOURCE_GROUP
```

### Container Health Debugging

```bash
# Test locally first
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  $ACR_NAME.azurecr.io/bodainsure-api:latest

# Check health endpoint
curl https://app-bodainsure-api-prod.azurewebsites.net/api/v1/health
```

---

## Quick Reference

### Docker Commands

| Command | Description |
|---------|-------------|
| `az acr build --registry $ACR_NAME --image bodainsure-api:latest .` | Build in ACR |
| `az acr repository list --name $ACR_NAME` | List repositories |
| `az acr repository show-tags --name $ACR_NAME --repository bodainsure-api` | List tags |
| `az acr repository delete --name $ACR_NAME --image bodainsure-api:old` | Delete image |

### App Service Commands

| Command | Description |
|---------|-------------|
| `az webapp restart -n $APP -g $RG` | Restart app |
| `az webapp log tail -n $APP -g $RG` | Stream logs |
| `az webapp config container show -n $APP -g $RG` | Show container config |
| `az webapp deployment slot swap -n $APP -g $RG -s staging` | Swap slots |

---

*Last updated: December 2024*
