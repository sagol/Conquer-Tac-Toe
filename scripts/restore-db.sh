#!/bin/bash
#
# Database Restore Script for Conquer-Tac-Toe
# Restores PostgreSQL and/or ClickHouse from backup
#
# Usage: 
#   ./restore-db.sh postgres <backup_file>
#   ./restore-db.sh clickhouse <backup_file>
#   ./restore-db.sh all <postgres_backup> <clickhouse_backup>
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage:"
    echo "  $0 postgres <backup_file.sql.gz>"
    echo "  $0 clickhouse <backup_file.tar.gz>"
    echo "  $0 all <postgres_backup> <clickhouse_backup>"
    exit 1
fi

MODE=$1

restore_postgres() {
    local BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "PostgreSQL backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Restoring PostgreSQL from: $BACKUP_FILE"
    log_warn "This will REPLACE all current database data!"
    read -p "Are you sure? (yes/no): " -r
    
    if [ "$REPLY" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Stop dependent services
    log_info "Stopping backend and autoplayer services..."
    docker stop conquertactoe_backend conquertactoe_autoplayer 2>/dev/null || true
    
    # Restore database
    log_info "Restoring PostgreSQL database..."
    gunzip < "$BACKUP_FILE" | docker exec -i conquertactoe_db psql -U postgres
    
    if [ $? -eq 0 ]; then
        log_info "PostgreSQL restore completed successfully"
    else
        log_error "PostgreSQL restore failed!"
        exit 1
    fi
    
    # Restart services
    log_info "Restarting services..."
    docker start conquertactoe_backend conquertactoe_autoplayer 2>/dev/null || true
}

restore_clickhouse() {
    local BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "ClickHouse backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log_info "Restoring ClickHouse from: $BACKUP_FILE"
    log_warn "This will REPLACE all current analytics data!"
    read -p "Are you sure? (yes/no): " -r
    
    if [ "$REPLY" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Stop ClickHouse
    log_info "Stopping ClickHouse container..."
    docker stop conquertactoe_clickhouse
    
    # Extract backup to temporary location
    TEMP_DIR=$(mktemp -d)
    tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
    
    # Copy data back to container
    log_info "Restoring data..."
    docker cp "$TEMP_DIR/clickhouse/." conquertactoe_clickhouse:/var/lib/clickhouse/
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    # Restart ClickHouse
    log_info "Restarting ClickHouse..."
    docker start conquertactoe_clickhouse
    
    log_info "ClickHouse restore completed successfully"
}

# Execute restore based on mode
case $MODE in
    postgres)
        restore_postgres "$2"
        ;;
    clickhouse)
        restore_clickhouse "$2"
        ;;
    all)
        restore_postgres "$2"
        restore_clickhouse "$3"
        ;;
    *)
        log_error "Invalid mode: $MODE"
        exit 1
        ;;
esac

log_info "Restore operation completed at $(date)"
