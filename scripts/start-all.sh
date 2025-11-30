#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Set Project Root to the 'conquertactoe' subdirectory which is a sibling of 'scripts'
PROJECT_ROOT="$SCRIPT_DIR/../conquertactoe"

echo "📂 Project Root detected at: $PROJECT_ROOT"

# Function to start a service
start_service() {
    local service_dir=$1
    local service_name=$2
    
    echo "------------------------------------------------"
    echo "🚀 Starting $service_name..."
    
    # Check if directory exists (using absolute path)
    if [ -d "$PROJECT_ROOT/$service_dir" ]; then
        
        # USE SUBSHELL (parentheses): This runs the cd/docker commands
        # in a temporary shell so the main script stays in the original folder.
        (
            cd "$PROJECT_ROOT/$service_dir" || exit
            docker compose up -d --build
        )
        
        # Check the exit code of the subshell
        if [ $? -eq 0 ]; then
            echo "✅ $service_name started successfully."
        else
            echo "❌ Failed to start $service_name."
            exit 1
        fi
    else
        echo "❌ Directory $service_dir not found inside $PROJECT_ROOT"
        echo "   (Checked path: $PROJECT_ROOT/$service_dir)"
        exit 1
    fi
}

echo "================================================"
echo "   Starting Conquer-Tac-Toe Environment"
echo "================================================"

# ------------------------------------------------
# NEW: Cleanup Section
# ------------------------------------------------
echo "🧹 Cleaning up old Docker garbage..."
# This removes stopped containers, unused networks, and dangling images.
# It does NOT remove volumes (Data is safe).
docker system prune -f
echo "✅ Cleanup complete."
echo "------------------------------------------------"

# 1. Create Network (if it doesn't exist)
if [ -z "$(docker network ls | grep conquer-network)" ]; then
    echo "🌐 Creating shared network 'conquer-network'..."
    docker network create conquer-network
else
    echo "🌐 Network 'conquer-network' already exists."
fi

# 2. Start Database (needs to be first)
start_service "conquertactoe-db" "PostgreSQL Database"

# Wait a few seconds for DB to initialize
echo "⏳ Waiting 5 seconds for Database to initialize..."
sleep 5

# 3. Start Backend
start_service "conquertactoe-backend" "Node.js Backend"

# 4. Start Frontend
start_service "conquertactoe-frontend" "React Frontend"

# 5. Start AI & Analytics
start_service "conquertactoe-autoplayer" "AI & ClickHouse Analytics"

# 6. Start Admin Dashboard
start_service "admin-dashboard" "Admin Dashboard"

echo "------------------------------------------------"
echo "🎉 All services are up and running!"
echo "================================================"