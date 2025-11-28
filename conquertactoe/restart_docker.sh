#!/bin/bash

# Define directories
ROOT_DIR=$(pwd)
DB_DIR="$ROOT_DIR/conquertactoe-db"
BACKEND_DIR="$ROOT_DIR/conquertactoe-backend"
FRONTEND_DIR="$ROOT_DIR/conquertactoe-frontend"
AUTOPLAYER_DIR="$ROOT_DIR/conquertactoe/autoplayer"

echo "=== Restarting Conquer-Tac-Toe Docker Containers ==="

# Function to stop containers
stop_containers() {
    echo "Stopping containers..."
    
    if [ -d "$FRONTEND_DIR" ]; then
        echo "Stopping Frontend..."
        (cd "$FRONTEND_DIR" && docker-compose down)
    fi

    if [ -d "$BACKEND_DIR" ]; then
        echo "Stopping Backend..."
        (cd "$BACKEND_DIR" && docker-compose down)
    fi

    if [ -d "$AUTOPLAYER_DIR" ]; then
        echo "Stopping Autoplayer & Clickhouse..."
        (cd "$AUTOPLAYER_DIR" && docker-compose down)
    fi

    if [ -d "$DB_DIR" ]; then
        echo "Stopping DB..."
        (cd "$DB_DIR" && docker-compose down)
    fi
}

# Function to start containers
start_containers() {
    echo "Starting containers..."

    # Create network if not exists
    docker network inspect conquer-network >/dev/null 2>&1 || \
        docker network create conquer-network

    if [ -d "$DB_DIR" ]; then
        echo "Starting DB..."
        (cd "$DB_DIR" && docker-compose up -d --build)
    else
        echo "Error: DB directory not found at $DB_DIR"
        exit 1
    fi

    if [ -d "$AUTOPLAYER_DIR" ]; then
        echo "Starting Autoplayer & Clickhouse..."
        (cd "$AUTOPLAYER_DIR" && docker-compose up -d --build)
    else
        echo "Error: Autoplayer directory not found at $AUTOPLAYER_DIR"
        exit 1
    fi

    if [ -d "$BACKEND_DIR" ]; then
        echo "Starting Backend..."
        (cd "$BACKEND_DIR" && docker-compose up -d --build)
    else
        echo "Error: Backend directory not found at $BACKEND_DIR"
        exit 1
    fi

    if [ -d "$FRONTEND_DIR" ]; then
        echo "Starting Frontend..."
        (cd "$FRONTEND_DIR" && docker-compose up -d --build)
    else
        echo "Error: Frontend directory not found at $FRONTEND_DIR"
        exit 1
    fi
}

stop_containers
start_containers

echo "=== All containers restarted ==="
docker ps
