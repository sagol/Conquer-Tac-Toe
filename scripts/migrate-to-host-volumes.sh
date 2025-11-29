#!/bin/bash
#
# Database Migration Script
# Migrates PostgreSQL and ClickHouse from Docker volumes to host bind mounts
#
# Usage: ./migrate-to-host-volumes.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo "=========================================="
echo "  Database Migration to Host Volumes"
echo "=========================================="
echo ""

log_warn "This script will:"
log_warn "1. Stop all containers"
log_warn "2. Copy database data from Docker volumes to host directories"
log_warn "3. Update docker-compose.yml files"
log_warn "4. Restart containers with new configuration"
log_warn ""
log_warn "Estimated downtime: 5-10 minutes"
echo ""
read -p "Do you want to continue? (yes/no): " -r
echo ""

if [ "$REPLY" != "yes" ]; then
    log_info "Migration cancelled"
    exit 0
fi

# ============================================
# Step 1: Stop containers
# ============================================
log_step "1/6: Stopping all containers..."
docker stop conquertactoe_backend conquertactoe_frontend conquertactoe_admin_backend conquertactoe_admin_frontend conquertactoe_autoplayer conquertactoe_clickhouse conquertactoe_db 2>/dev/null || true
log_info "All containers stopped"

# ============================================
# Step 2: Create host directories
# ============================================
log_step "2/6: Creating host directories..."
mkdir -p "$PROJECT_ROOT/conquertactoe/conquertactoe-db/data/postgres"
mkdir -p "$PROJECT_ROOT/conquertactoe/conquertactoe/autoplayer/data/clickhouse"
log_info "Directories created"

# ============================================
# Step 3: Copy PostgreSQL data
# ============================================
log_step "3/6: Migrating PostgreSQL data..."
log_info "This may take a few minutes..."

# Start temporary container to access volume
docker run --rm \
    -v conquertactoe-db_pgdata:/source:ro \
    -v "$PROJECT_ROOT/conquertactoe/conquertactoe-db/data/postgres":/dest \
    alpine \
    sh -c "cp -a /source/. /dest/"

if [ $? -eq 0 ]; then
    PG_SIZE=$(du -sh "$PROJECT_ROOT/conquertactoe/conquertactoe-db/data/postgres" | cut -f1)
    log_info "PostgreSQL data migrated successfully ($PG_SIZE)"
else
    log_error "PostgreSQL migration failed!"
    exit 1
fi

# ============================================
# Step 4: Copy ClickHouse data
# ============================================
log_step "4/6: Migrating ClickHouse data..."

docker run --rm \
    -v autoplayer_clickhouse_data:/source:ro \
    -v "$PROJECT_ROOT/conquertactoe/conquertactoe/autoplayer/data/clickhouse":/dest \
    alpine \
    sh -c "cp -a /source/. /dest/"

if [ $? -eq 0 ]; then
    CH_SIZE=$(du -sh "$PROJECT_ROOT/conquertactoe/conquertactoe/autoplayer/data/clickhouse" | cut -f1)
    log_info "ClickHouse data migrated successfully ($CH_SIZE)"
else
    log_error "ClickHouse migration failed!"
    exit 1
fi

# ============================================
# Step 5: Update docker-compose files
# ============================================
log_step "5/6: Updating docker-compose.yml files..."

# Update PostgreSQL docker-compose.yml
sed -i.bak 's|- pgdata:/var/lib/postgresql/data|- ./data/postgres:/var/lib/postgresql/data|' \
    "$PROJECT_ROOT/conquertactoe/conquertactoe-db/docker-compose.yml"

# Remove volumes section from PostgreSQL docker-compose.yml
sed -i.bak '/^volumes:$/,/^[^ ]/ { /^volumes:$/d; /^  pgdata:$/d; }' \
    "$PROJECT_ROOT/conquertactoe/conquertactoe-db/docker-compose.yml"

# Update ClickHouse docker-compose.yml
sed -i.bak 's|- clickhouse_data:/var/lib/clickhouse|- ./data/clickhouse:/var/lib/clickhouse|' \
    "$PROJECT_ROOT/conquertactoe/conquertactoe/autoplayer/docker-compose.yml"

# Remove volumes section from ClickHouse docker-compose.yml  
sed -i.bak '/^volumes:$/,/^[^ ]/ { /^volumes:$/d; /^  clickhouse_data:$/d; }' \
    "$PROJECT_ROOT/conquertactoe/conquertactoe/autoplayer/docker-compose.yml"

log_info "docker-compose.yml files updated (backups saved as .bak)"

# ============================================
# Step 6: Restart containers
# ============================================
log_step "6/6: Restarting containers..."

cd "$PROJECT_ROOT/conquertactoe/conquertactoe-db" && docker-compose up -d
cd "$PROJECT_ROOT/conquertactoe/conquertactoe/autoplayer" && docker-compose up -d
cd "$PROJECT_ROOT/conquertactoe/conquertactoe-backend" && docker-compose up -d
cd "$PROJECT_ROOT/conquertactoe/conquertactoe-frontend" && docker-compose up -d
cd "$PROJECT_ROOT/conquertactoe/admin-dashboard" && docker-compose up -d

log_info "All containers restarted"

# ============================================
# Verification
# ============================================
echo ""
log_info "Migration completed successfully!"
echo ""
log_info "Next steps:"
echo "  1. Verify application is working: http://localhost:3001"
echo "  2. Check database connectivity"
echo "  3. If everything works, remove old Docker volumes:"
echo "     docker volume rm conquertactoe-db_pgdata"
echo "     docker volume rm autoplayer_clickhouse_data"
echo ""
log_warn "Keep the .bak files until you've verified everything works"
echo ""
