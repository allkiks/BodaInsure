# BodaInsure Development Makefile
# Usage: make dev-docker
#
# This Makefile provides commands for 100% Docker-based development.
# No services run on the host machine - everything runs in containers.
#
# WINDOWS USERS: This Makefile requires Git Bash, WSL, or a Unix shell.
# For PowerShell/CMD, use: .\dev-docker.cmd start

# Force using bash shell (required for Unix commands)
SHELL := /bin/bash

# Cross-platform wait using Docker
WAIT := docker run --rm alpine sleep

# Configuration
DOCKER_COMPOSE_FILE := docker/dev/docker-compose.yml
DOCKER_COMPOSE := docker compose -f $(DOCKER_COMPOSE_FILE)
PROJECT_NAME := bodainsure

.PHONY: help dev-docker dev-docker-build dev-docker-up dev-docker-down dev-docker-logs \
        dev-docker-restart dev-docker-clean dev-docker-tools dev-migrate dev-shell-server \
        dev-shell-client dev-test dev-lint

# Default target
.DEFAULT_GOAL := help

##@ Help

help: ## Display this help message
	@echo "=========================================="
	@echo "  BodaInsure Development Commands"
	@echo "=========================================="
	@echo ""
	@echo "NOTE: On Windows, run from Git Bash or use: .\\dev-docker.cmd start"
	@echo ""
	@echo "Primary Command:"
	@echo "  make dev-docker     Start the full development environment (recommended)"
	@echo ""
	@echo "Available Commands:"
	@echo "  dev-docker          Start full Docker environment"
	@echo "  dev-docker-build    Build all Docker images"
	@echo "  dev-docker-up       Start all services (no rebuild)"
	@echo "  dev-docker-down     Stop all services"
	@echo "  dev-docker-restart  Restart all services"
	@echo "  dev-docker-logs     View logs (follow mode)"
	@echo "  dev-docker-clean    Remove all containers and volumes"
	@echo "  dev-docker-tools    Start optional dev tools"
	@echo "  dev-migrate         Run database migrations"
	@echo "  dev-shell-server    Open server shell"
	@echo "  dev-shell-client    Open client shell"
	@echo "  dev-status          Show container status"
	@echo ""

##@ Development Environment

dev-docker: ## Start the full Docker development environment (builds, starts, runs migrations)
	@echo "=========================================="
	@echo "  BodaInsure Docker Development Setup"
	@echo "=========================================="
	@echo ""
	@echo "[1/5] Checking Docker..."
	@docker --version || (echo "Error: Docker is not installed or not running" && exit 1)
	@docker compose version || (echo "Error: Docker Compose is not installed" && exit 1)
	@echo "  Docker is ready!"
	@echo ""
	@echo "[2/5] Building Docker images..."
	$(DOCKER_COMPOSE) build --parallel
	@echo "  Build complete!"
	@echo ""
	@echo "[3/5] Starting infrastructure services..."
	@$(DOCKER_COMPOSE) up -d --wait postgres redis minio mailhog minio-init >/dev/null 2>&1 || (echo "  Infrastructure starting..." && $(WAIT) 10)
	@echo "  Infrastructure ready!"
	@echo ""
	@echo "[4/5] Starting application services..."
	@echo "  Starting server (migrations and seeding may take 30-60 seconds on first run)..."
	$(DOCKER_COMPOSE) up -d server
	@echo "  Starting client..."
	$(DOCKER_COMPOSE) up -d client
	@echo "  Waiting for services to be ready..."
	@$(WAIT) 30
	@echo ""
	@echo "[5/5] Environment Ready!"
	@echo ""
	@echo "=========================================="
	@echo "  BodaInsure Development Environment"
	@echo "=========================================="
	@echo ""
	@echo "Application Services:"
	@echo "  Frontend (Admin):  http://localhost:5173"
	@echo "  Backend API:       http://localhost:3000/api/v1"
	@echo "  API Health:        http://localhost:3000/api/v1/health"
	@echo ""
	@echo "Infrastructure Services:"
	@echo "  PostgreSQL:        localhost:5432 (bodainsure/bodainsure)"
	@echo "  Redis:             localhost:6379"
	@echo "  MinIO Console:     http://localhost:9001 (bodainsure/bodainsure123)"
	@echo "  MinIO S3 API:      http://localhost:9000"
	@echo "  MailHog (Email):   http://localhost:8025"
	@echo ""
	@echo "Development Tools (optional):"
	@echo "  Run 'make dev-docker-tools' to start:"
	@echo "  - pgAdmin:         http://localhost:8080"
	@echo "  - Redis Commander: http://localhost:8081"
	@echo ""
	@echo "Useful Commands:"
	@echo "  make dev-docker-logs     View all logs"
	@echo "  make dev-docker-restart  Restart all services"
	@echo "  make dev-docker-down     Stop all services"
	@echo "  make dev-migrate         Run database migrations"
	@echo "  make dev-shell-server    Open server shell"
	@echo "  make dev-shell-client    Open client shell"
	@echo ""
	@echo "=========================================="

dev-docker-build: ## Build all Docker images
	@echo "Building Docker images..."
	$(DOCKER_COMPOSE) build --parallel

dev-docker-up: ## Start all services (without rebuild)
	@echo "Starting all services..."
	$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "Services started. Run 'make dev-docker-logs' to view logs."

dev-docker-down: ## Stop all services
	@echo "Stopping all services..."
	$(DOCKER_COMPOSE) down

dev-docker-restart: ## Restart all services
	@echo "Restarting all services..."
	$(DOCKER_COMPOSE) restart
	@echo "Services restarted."

dev-docker-logs: ## View logs from all services (follow mode)
	$(DOCKER_COMPOSE) logs -f

dev-docker-logs-server: ## View server logs only
	$(DOCKER_COMPOSE) logs -f server

dev-docker-logs-client: ## View client logs only
	$(DOCKER_COMPOSE) logs -f client

dev-docker-clean: ## Stop services and remove volumes (WARNING: deletes data)
	@echo "WARNING: This will delete all data including the database!"
	@echo "Press Ctrl+C within 5 seconds to cancel..."
	@$(WAIT) 5
	@echo "Cleaning up..."
	$(DOCKER_COMPOSE) down -v --remove-orphans
	-docker volume rm bodainsure_postgres_data bodainsure_redis_data bodainsure_minio_data
	-docker volume rm bodainsure_server_node_modules bodainsure_client_node_modules
	@echo "Cleanup complete."

dev-docker-tools: ## Start optional development tools (pgAdmin, Redis Commander)
	@echo "Starting development tools..."
	$(DOCKER_COMPOSE) --profile tools up -d
	@echo ""
	@echo "Development tools started:"
	@echo "  pgAdmin:         http://localhost:8080 (admin@bodainsure.co.ke / admin123)"
	@echo "  Redis Commander: http://localhost:8081"

##@ Database

dev-migrate: ## Run database migrations inside the server container
	@echo "Running database migrations..."
	$(DOCKER_COMPOSE) exec server npm run migration:run

dev-migrate-generate: ## Generate a new migration (usage: make dev-migrate-generate NAME=MigrationName)
	@echo "Generating migration: $(NAME)"
	$(DOCKER_COMPOSE) exec server npm run migration:generate -- src/database/migrations/$(NAME)

dev-migrate-revert: ## Revert the last migration
	@echo "Reverting last migration..."
	$(DOCKER_COMPOSE) exec server npm run migration:revert

dev-migrate-show: ## Show migration status
	@echo "Migration status:"
	$(DOCKER_COMPOSE) exec server npm run migration:show

##@ Shell Access

dev-shell-server: ## Open a shell in the server container
	$(DOCKER_COMPOSE) exec server sh

dev-shell-client: ## Open a shell in the client container
	$(DOCKER_COMPOSE) exec client sh

dev-shell-postgres: ## Open a PostgreSQL shell
	$(DOCKER_COMPOSE) exec postgres psql -U bodainsure -d bodainsure

dev-shell-redis: ## Open a Redis CLI shell
	$(DOCKER_COMPOSE) exec redis redis-cli

##@ Testing

dev-test: ## Run tests in the server container
	@echo "Running server tests..."
	$(DOCKER_COMPOSE) exec server npm run test

dev-test-e2e: ## Run e2e tests in the server container
	@echo "Running e2e tests..."
	$(DOCKER_COMPOSE) exec server npm run test:e2e

dev-test-cov: ## Run tests with coverage
	@echo "Running tests with coverage..."
	$(DOCKER_COMPOSE) exec server npm run test:cov

dev-lint: ## Run linting in server and client containers
	@echo "Running linting..."
	$(DOCKER_COMPOSE) exec server npm run lint
	$(DOCKER_COMPOSE) exec client npm run lint

##@ Status

dev-status: ## Show status of all containers
	@echo "Container Status:"
	$(DOCKER_COMPOSE) ps

dev-health: ## Check health of all services
	@echo "Service Health:"
	@echo ""
	@echo "PostgreSQL:"
	$(DOCKER_COMPOSE) exec -T postgres pg_isready -U bodainsure -d bodainsure
	@echo ""
	@echo "Redis:"
	$(DOCKER_COMPOSE) exec -T redis redis-cli ping
	@echo ""
	@echo "Server API:"
	-curl -sf http://localhost:3000/api/v1/health
	@echo ""
	@echo "Client:"
	-curl -sf http://localhost:5173
