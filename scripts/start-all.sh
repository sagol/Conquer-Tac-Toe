#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Set Project Root to the 'conquertactoe' subdirectory which is a sibling of 'scripts'
PROJECT_ROOT="$SCRIPT_DIR/../conquertactoe"

echo "📂 Project Root detected at: $PROJECT_ROOT"

# ----------------------------------------------------------------
# HELPER: Enable Docker System Service
# This ensures the Docker Daemon itself starts when the server boots.
# ----------------------------------------------------------------
echo "⚙️  Ensuring Docker starts on boot..."
sudo systemctl enable docker > /dev/null 2>&1

# Function to start a service
start_service() {
    local service_dir=$1
    local service_name=$2
    
    echo "------------------------------------------------"
    echo "🚀 Starting $service_name..."
    
    # Check if directory exists (using absolute path)
    if [ -d "$PROJECT_ROOT/$service_dir" ]; then
        
        # USE SUBSHELL to handle directory changes
        (
            cd "$PROJECT_ROOT/$service_dir" || exit
            
            # 1. Build and Start
            docker compose up -d --build
            
            # 2. Check success
            if [ $? -eq 0 ]; then
                echo "✅ $service_name started successfully."
                
                # 3. APPLY RESTART POLICY (The Magic Fix)
                # We get the IDs of the containers just created by this compose file
                # and force their restart policy to 'unless-stopped'.
                CONTAINER_IDS=$(docker compose ps -q)
                if [ -n "$CONTAINER_IDS" ]; then
                    echo "   🔄 Applying auto-restart policy (unless-stopped)..."
                    docker update --restart unless-stopped $CONTAINER_IDS > /dev/null
                fi
            else
                echo "❌ Failed to start $service_name."
                exit 1
            fi
        )
        
        # Check exit code of subshell
        if [ $? -ne 0 ]; then
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
# CLEANUP
# ------------------------------------------------
echo "🧹 Cleaning up old Docker garbage..."
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

# Wait for DB to be ready and tables to be initialized
    # Wait for DB to be ready (2-Stage Check)
    echo "⏳ Waiting for Database to be ready..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    DB_CONNECTED=0
    SCHEMA_READY=0

    (
        cd "$PROJECT_ROOT/conquertactoe-db" || exit
        
        # Stage 1: Wait for Connection
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
                echo "   ✅ Database is accepting connections."
                DB_CONNECTED=1
                break
            fi
            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "   Scanning for active database connection ($RETRY_COUNT/$MAX_RETRIES)..."
            sleep 2
        done

        if [ $DB_CONNECTED -eq 0 ]; then
            echo "❌ Database failed to start responding within timeout."
            exit 1
        fi

        # Stage 2: Check for Schema (Users table)
        if docker compose exec -T db psql -U postgres -d conquertactoe -c "SELECT 1 FROM users LIMIT 1;" > /dev/null 2>&1; then
            echo "   ✅ Database schema verified (Users table exists)."
            SCHEMA_READY=1
        else
            echo "   ⚠️  Database connected but 'users' table not found. Initialization required."
        fi
        
        # Return status code based on Schema Readiness
        if [ $SCHEMA_READY -eq 1 ]; then
            exit 0
        else
            exit 2 # Special code for "Up but needs init"
        fi
    )
    CHECK_RESULT=$?

    if [ $CHECK_RESULT -eq 0 ]; then
        echo "✅ Database is fully ready."
    elif [ $CHECK_RESULT -eq 2 ]; then
        echo "⚙️  Database empty. Running manual initialization..."
        docker exec conquertactoe_db psql -U postgres -c "CREATE DATABASE conquertactoe;" 2>/dev/null || true
        # Run init scripts
        docker exec conquertactoe_db psql -U postgres -d conquertactoe -f /docker-entrypoint-initdb.d/init.sql
        docker exec conquertactoe_db psql -U postgres -d conquertactoe -f /docker-entrypoint-initdb.d/02_create_notifications_table.sql
        echo "✅ Manual database initialization completed."
    else
        echo "❌ Critical Error: Database service is not responding."
        # We don't exit here to allow debugging, but usage might fail
    fi

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
echo "   The server will now automatically restore these containers after a reboot."
echo "================================================"