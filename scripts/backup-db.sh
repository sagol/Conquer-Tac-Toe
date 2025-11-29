#!/bin/bash
#
# Database Backup Script for Conquer-Tac-Toe
# Backs up PostgreSQL and ClickHouse databases
# Keeps last 7 backups, auto-deletes older ones
#
# Usage: ./backup-db.sh
#

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
RETENTION_DAYS=7

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log_info "Starting database backup at $(date)"
log_info "Backup directory: $BACKUP_DIR"

# ============================================
# PostgreSQL Backup
# ============================================
log_info "Backing up PostgreSQL..."

POSTGRES_BACKUP="$BACKUP_DIR/postgres_${TIMESTAMP}.sql.gz"

# Check if PostgreSQL container is running
if ! docker ps | grep -q conquertactoe_db; then
    log_error "PostgreSQL container is not running!"
    exit 1
fi

# Perform backup using pg_dump
docker exec conquertactoe_db pg_dumpall -U postgres | gzip > "$POSTGRES_BACKUP"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$POSTGRES_BACKUP" | cut -f1)
    log_info "PostgreSQL backup completed: $POSTGRES_BACKUP ($BACKUP_SIZE)"
else
    log_error "PostgreSQL backup failed!"
    exit 1
fi

# ============================================
# ClickHouse Backup
# ============================================
log_info "Backing up ClickHouse..."

CLICKHOUSE_BACKUP="$BACKUP_DIR/clickhouse_${TIMESTAMP}.tar.gz"

# Check if ClickHouse container is running
if ! docker ps | grep -q conquertactoe_clickhouse; then
    log_warn "ClickHouse container is not running, skipping backup"
else
    # Get ClickHouse data directory from container
    # Using docker cp to copy the data directory
    TEMP_DIR=$(mktemp -d)
    docker cp conquertactoe_clickhouse:/var/lib/clickhouse "$TEMP_DIR/"
    
    # Create compressed archive
    tar -czf "$CLICKHOUSE_BACKUP" -C "$TEMP_DIR" clickhouse
    
    # Cleanup temp directory
    rm -rf "$TEMP_DIR"
    
    if [ $? -eq 0 ]; then
        BACKUP_SIZE=$(du -h "$CLICKHOUSE_BACKUP" | cut -f1)
        log_info "ClickHouse backup completed: $CLICKHOUSE_BACKUP ($BACKUP_SIZE)"
    else
        log_error "ClickHouse backup failed!"
        exit 1
    fi
fi

# ============================================
# Cleanup Old Backups
# ============================================
log_info "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."

# Find and delete PostgreSQL backups older than retention period
DELETED_COUNT=0
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    log_info "Deleted old backup: $(basename "$old_backup")"
    ((DELETED_COUNT++))
done < <(find "$BACKUP_DIR" -name "postgres_*.sql.gz" -type f -mtime +$RETENTION_DAYS)

# Find and delete ClickHouse backups older than retention period
while IFS= read -r old_backup; do
    rm -f "$old_backup"
    log_info "Deleted old backup: $(basename "$old_backup")"
    ((DELETED_COUNT++))
done < <(find "$BACKUP_DIR" -name "clickhouse_*.tar.gz" -type f -mtime +$RETENTION_DAYS)

if [ $DELETED_COUNT -gt 0 ]; then
    log_info "Deleted $DELETED_COUNT old backup(s)"
else
    log_info "No old backups to delete"
fi

# ============================================
# Summary
# ============================================
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -type f \( -name "postgres_*.sql.gz" -o -name "clickhouse_*.tar.gz" \) | wc -l)
log_info "Backup completed successfully at $(date)"
log_info "Total backups in storage: $TOTAL_BACKUPS"
log_info "Backup retention: $RETENTION_DAYS days"

exit 0
