#!/bin/bash

# ==============================================================================
# Conquer-Tac-Toe Installation Script
# ==============================================================================
# This script installs the application from scratch.
# It performs the following actions:
# 1. Defines all environment variables for the entire stack.
# 2. Generates .env files for each service.
# 3. Tears down existing Docker containers and volumes (CLEAN INSTALL).
# 4. Rebuilds and starts all services.
# ==============================================================================

# Exit on error
set -e

echo "========================================================"
echo "   Conquer-Tac-Toe Installer - Fresh Install"
echo "========================================================"

# ------------------------------------------------------------------------------
# 1. Configuration & Environment Variables
# ------------------------------------------------------------------------------
echo "--> Configuring Environment Variables..."

# Network
export NETWORK_NAME=conquer-network

# Database (PostgreSQL)
export POSTGRES_DB=conquertactoe
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_HOST=conquertactoe_db
export POSTGRES_PORT=5432
export DATABASE_URL=postgresql://postgres:postgres@conquertactoe_db:5432/conquertactoe
export POSTGRES_HOST_PORT=5433
export POSTGRES_CONTAINER_PORT=5432

# ClickHouse
export CLICKHOUSE_CONTAINER_NAME=conquertactoe_clickhouse
export CLICKHOUSE_HOST=clickhouse
export CLICKHOUSE_DB=default
export CLICKHOUSE_USER=default
export CLICKHOUSE_PASSWORD=
export CLICKHOUSE_HTTP_PORT=8123
export CLICKHOUSE_NATIVE_PORT=9000

# Backend
export BACKEND_PORT=3000
export SESSION_SECRET=super_secret_session_key_change_me
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret
export CLIENT_URL=http://localhost:3001

# Frontend
export REACT_APP_BACKEND_URL=http://localhost:3000
export FRONTEND_HOST_PORT=3001
export FRONTEND_CONTAINER_PORT=3000

# Autoplayer
export AUTOPLAYER_CONTAINER_NAME=conquertactoe_autoplayer
export AUTOPLAYER_PORT=8000

# Admin Dashboard Backend
export ADMIN_BACKEND_PORT=4000
export ADMIN_JWT_SECRET=$(openssl rand -hex 32)
export ADMIN_JWT_REFRESH_SECRET=$(openssl rand -hex 32)
export ADMIN_ACCESS_TOKEN_EXPIRY=1h
export ADMIN_REFRESH_TOKEN_EXPIRY=7d
export ADMIN_ALLOWED_ORIGINS=http://localhost:3002
export ADMIN_DEFAULT_EMAIL=admin@conquertactoe.com
export ADMIN_DEFAULT_PASSWORD=admin123
export ADMIN_DEFAULT_USERNAME=admin
export ADMIN_FRONTEND_URL=http://localhost:3002
export ADMIN_GOOGLE_CALLBACK_URL=${ADMIN_GOOGLE_CALLBACK_URL:-http://localhost:4000/admin/auth/google/callback}

# Admin Dashboard Frontend
export REACT_APP_ADMIN_API_URL=http://localhost:4000/admin
export REACT_APP_WEBSOCKET_URL=ws://localhost:4000

# ------------------------------------------------------------------------------
# 2. Generate .env Files
# ------------------------------------------------------------------------------
echo "--> Generating .env files..."

# DB Service
cat > conquertactoe/conquertactoe-db/.env <<EOF
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_HOST_PORT=$POSTGRES_HOST_PORT
POSTGRES_CONTAINER_PORT=$POSTGRES_CONTAINER_PORT
NETWORK_NAME=$NETWORK_NAME
EOF

# Backend Service
cat > conquertactoe/conquertactoe-backend/.env <<EOF
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PORT=$POSTGRES_PORT
DATABASE_URL=$DATABASE_URL
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL:-http://localhost:3000/auth/google/callback}
SESSION_SECRET=$SESSION_SECRET
PORT=$BACKEND_PORT
CLIENT_URL=$CLIENT_URL
NETWORK_NAME=$NETWORK_NAME
EOF

# Frontend Service
cat > conquertactoe/conquertactoe-frontend/.env <<EOF
REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
FRONTEND_HOST_PORT=$FRONTEND_HOST_PORT
FRONTEND_CONTAINER_PORT=$FRONTEND_CONTAINER_PORT
NETWORK_NAME=$NETWORK_NAME
EOF

# Autoplayer Service
cat > conquertactoe/conquertactoe-autoplayer/.env <<EOF
NETWORK_NAME=$NETWORK_NAME
AUTOPLAYER_CONTAINER_NAME=$AUTOPLAYER_CONTAINER_NAME
AUTOPLAYER_PORT=$AUTOPLAYER_PORT
CLICKHOUSE_CONTAINER_NAME=$CLICKHOUSE_CONTAINER_NAME
CLICKHOUSE_HOST=$CLICKHOUSE_HOST
CLICKHOUSE_DB=$CLICKHOUSE_DB
CLICKHOUSE_USER=$CLICKHOUSE_USER
CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
CLICKHOUSE_HTTP_PORT=$CLICKHOUSE_HTTP_PORT
CLICKHOUSE_NATIVE_PORT=$CLICKHOUSE_NATIVE_PORT
EOF

# Admin Dashboard Backend
cat > conquertactoe/admin-dashboard/backend/.env <<EOF
DATABASE_URL=$DATABASE_URL
CLICKHOUSE_HOST=$CLICKHOUSE_HOST
CLICKHOUSE_PORT=$CLICKHOUSE_NATIVE_PORT
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
ADMIN_JWT_REFRESH_SECRET=$ADMIN_JWT_REFRESH_SECRET
ACCESS_TOKEN_EXPIRY=$ADMIN_ACCESS_TOKEN_EXPIRY
REFRESH_TOKEN_EXPIRY=$ADMIN_REFRESH_TOKEN_EXPIRY
PORT=$ADMIN_BACKEND_PORT
NODE_ENV=development
ADMIN_ALLOWED_ORIGINS=$ADMIN_ALLOWED_ORIGINS
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
ADMIN_DEFAULT_EMAIL=$ADMIN_DEFAULT_EMAIL
ADMIN_DEFAULT_PASSWORD=$ADMIN_DEFAULT_PASSWORD
ADMIN_DEFAULT_USERNAME=$ADMIN_DEFAULT_USERNAME
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=$ADMIN_GOOGLE_CALLBACK_URL
ADMIN_ALLOWED_EMAILS=admin@conquertactoe.com
SESSION_SECRET=$SESSION_SECRET
ADMIN_FRONTEND_URL=$ADMIN_FRONTEND_URL
NETWORK_NAME=$NETWORK_NAME
EOF

# Admin Dashboard Frontend
cat > conquertactoe/admin-dashboard/frontend/.env <<EOF
REACT_APP_ADMIN_API_URL=$REACT_APP_ADMIN_API_URL
REACT_APP_WEBSOCKET_URL=$REACT_APP_WEBSOCKET_URL
EOF

echo "--> .env files generated successfully."

# ------------------------------------------------------------------------------
# 3. Clean Install (Teardown & Rebuild)
# ------------------------------------------------------------------------------
echo "--> Starting Clean Installation..."

# Function to run docker-compose command in a directory
run_compose() {
    local dir=$1
    local cmd=$2
    if [ -d "$dir" ]; then
        echo "Executing '$cmd' in $dir..."
        (cd "$dir" && docker-compose $cmd)
    else
        echo "Warning: Directory $dir not found."
    fi
}

# Stop and remove everything (including volumes for DB reset)
echo "--> Stopping and removing existing containers and volumes..."
run_compose "conquertactoe/conquertactoe-frontend" "down -v"
run_compose "conquertactoe/conquertactoe-backend" "down -v"
run_compose "conquertactoe/conquertactoe-autoplayer" "down -v"
run_compose "conquertactoe/admin-dashboard" "down -v"
run_compose "conquertactoe/conquertactoe-db" "down -v"

# Prune network to be safe
echo "--> Pruning network..."
docker network rm $NETWORK_NAME 2>/dev/null || true
docker network create $NETWORK_NAME

# Start DB first
echo "--> Starting Database..."
run_compose "conquertactoe/conquertactoe-db" "up -d --build"
echo "Waiting for Database to be ready..."
sleep 10 # Give DB some time to initialize

# Start Autoplayer (ClickHouse + Python Service)
echo "--> Starting Autoplayer & ClickHouse..."
run_compose "conquertactoe/conquertactoe-autoplayer" "up -d --build"

# Start Backend
echo "--> Starting Backend..."
run_compose "conquertactoe/conquertactoe-backend" "up -d --build"

# Start Frontend
echo "--> Starting Frontend..."
run_compose "conquertactoe/conquertactoe-frontend" "up -d --build"

# Start Admin Dashboard
echo "--> Starting Admin Dashboard..."
run_compose "conquertactoe/admin-dashboard" "up -d --build"

echo "========================================================"
echo "   Installation Complete! 🚀"
echo "========================================================"
echo "Access points:"
echo "- Main App: http://localhost:3001"
echo "- Admin Dashboard: http://localhost:3002"
echo "- Backend API: http://localhost:3000"
echo "- Admin API: http://localhost:4000"
echo "========================================================"
