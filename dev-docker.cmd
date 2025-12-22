@echo off
REM =============================================================================
REM BodaInsure Docker Development Environment Script (Windows)
REM =============================================================================
REM Usage: dev-docker.cmd [command]
REM
REM Environment Configuration:
REM   All environment files are at the project root:
REM   - .env.example  (template - committed to git)
REM   - .env.docker   (Docker development - gitignored)
REM   - .env.local    (local development - gitignored)
REM
REM Commands:
REM   start     - Start the full development environment (default)
REM   setup     - Create .env.docker from .env.example (first-time setup)
REM   stop      - Stop all services
REM   restart   - Restart all services
REM   logs      - View logs from all services
REM   clean     - Stop services and remove volumes
REM   status    - Show status of all containers
REM   tools     - Start optional development tools
REM   migrate   - Run database migrations
REM   shell     - Open shell in server container
REM =============================================================================

setlocal enabledelayedexpansion

set DOCKER_COMPOSE_FILE=docker/dev/docker-compose.yml
set ENV_FILE=.env.docker
set DOCKER_COMPOSE=docker compose -f %DOCKER_COMPOSE_FILE% --env-file %ENV_FILE%
set COMMAND=%1

if "%COMMAND%"=="" set COMMAND=start

REM Change to project root directory
cd /d "%~dp0"

if "%COMMAND%"=="start" goto :check_env
if "%COMMAND%"=="setup" goto :setup
if "%COMMAND%"=="stop" goto :stop
if "%COMMAND%"=="restart" goto :restart
if "%COMMAND%"=="logs" goto :logs
if "%COMMAND%"=="clean" goto :clean
if "%COMMAND%"=="status" goto :status
if "%COMMAND%"=="tools" goto :tools
if "%COMMAND%"=="migrate" goto :migrate
if "%COMMAND%"=="shell" goto :shell
if "%COMMAND%"=="help" goto :help

echo Unknown command: %COMMAND%
goto :help

:check_env
if not exist ".env.docker" (
    echo.
    echo ERROR: .env.docker not found!
    echo.
    echo Run 'dev-docker.cmd setup' to create it from .env.example
    echo Or manually: copy .env.example .env.docker
    echo.
    exit /b 1
)
goto :start

:setup
echo Setting up development environment...
if exist ".env.docker" (
    echo   .env.docker already exists. Skipping.
    echo   To reset, delete .env.docker and run this command again.
) else (
    if exist ".env.example" (
        copy .env.example .env.docker >nul
        echo   Created .env.docker from .env.example
        echo.
        echo   Edit .env.docker if you need to customize settings.
        echo   Default values work for Docker development.
    ) else (
        echo ERROR: .env.example not found!
        exit /b 1
    )
)
echo.
echo Setup complete! Run 'dev-docker.cmd start' to start.
goto :eof

:start
echo ==========================================
echo   BodaInsure Docker Development Setup
echo ==========================================
echo.
echo [1/5] Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running
    exit /b 1
)
docker compose version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker Compose is not installed
    exit /b 1
)
echo   Docker is ready!
echo.

echo [2/5] Building Docker images...
%DOCKER_COMPOSE% build --parallel
if errorlevel 1 (
    echo ERROR: Failed to build Docker images
    exit /b 1
)
echo   Build complete!
echo.

echo [3/5] Starting infrastructure services...
%DOCKER_COMPOSE% up -d --wait postgres redis minio mailhog minio-init >nul 2>&1
if errorlevel 1 (
    echo   Infrastructure starting...
    timeout /t 10 /nobreak >nul
) else (
    echo   Infrastructure ready!
)
echo.

echo [4/5] Starting application services...
echo   Starting server (migrations and seeding may take 30-60 seconds on first run)...
%DOCKER_COMPOSE% up -d server
echo   Starting client...
%DOCKER_COMPOSE% up -d client
echo   Waiting for services to be ready...
timeout /t 30 /nobreak >nul
echo.

echo [5/5] Environment Ready!
echo.
echo ==========================================
echo   BodaInsure Development Environment
echo ==========================================
echo.
echo Application Services:
echo   Frontend (Admin):  http://localhost:5173
echo   Backend API:       http://localhost:3000/api/v1
echo   API Health:        http://localhost:3000/api/v1/health
echo.
echo Infrastructure Services:
echo   PostgreSQL:        localhost:5432 (bodainsure/bodainsure)
echo   Redis:             localhost:6379
echo   MinIO Console:     http://localhost:9001 (bodainsure/bodainsure123)
echo   MinIO S3 API:      http://localhost:9000
echo   MailHog (Email):   http://localhost:8025
echo.
echo Useful Commands:
echo   dev-docker.cmd logs     - View all logs
echo   dev-docker.cmd restart  - Restart all services
echo   dev-docker.cmd stop     - Stop all services
echo   dev-docker.cmd migrate  - Run database migrations
echo   dev-docker.cmd shell    - Open server shell
echo.
echo ==========================================
goto :eof

:stop
echo Stopping all services...
%DOCKER_COMPOSE% down
echo Services stopped.
goto :eof

:restart
echo Restarting all services...
%DOCKER_COMPOSE% restart
echo Services restarted.
goto :eof

:logs
%DOCKER_COMPOSE% logs -f
goto :eof

:clean
echo WARNING: This will delete all data including the database!
echo Press Ctrl+C within 5 seconds to cancel...
timeout /t 5 /nobreak >nul
echo Cleaning up...
%DOCKER_COMPOSE% down -v --remove-orphans
echo Cleanup complete.
goto :eof

:status
echo Container Status:
%DOCKER_COMPOSE% ps
goto :eof

:tools
echo Starting development tools...
%DOCKER_COMPOSE% --profile tools up -d
echo.
echo Development tools started:
echo   pgAdmin:         http://localhost:8080 (admin@bodainsure.co.ke / admin123)
echo   Redis Commander: http://localhost:8081
goto :eof

:migrate
echo Running database migrations...
%DOCKER_COMPOSE% exec server npm run migration:run
goto :eof

:shell
%DOCKER_COMPOSE% exec server sh
goto :eof

:help
echo.
echo ==========================================
echo   BodaInsure Docker Development Commands
echo ==========================================
echo.
echo Usage: dev-docker.cmd [command]
echo.
echo First-time Setup:
echo   dev-docker.cmd setup    Create .env.docker from .env.example
echo.
echo Commands:
echo   start     Start the full development environment (default)
echo   setup     Create .env.docker from .env.example (first-time)
echo   stop      Stop all services
echo   restart   Restart all services
echo   logs      View logs from all services
echo   clean     Stop services and remove volumes (WARNING: deletes data)
echo   status    Show status of all containers
echo   tools     Start optional development tools (pgAdmin, Redis Commander)
echo   migrate   Run database migrations
echo   shell     Open shell in server container
echo   help      Show this help message
echo.
goto :eof
