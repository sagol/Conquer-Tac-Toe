# Database Backup & Restore Guide

## Overview

This guide covers the database backup and restore procedures for Conquer-Tac-Toe. The system includes automated daily backups with 7-day retention for both PostgreSQL and ClickHouse databases.

## Architecture

### Storage Locations

- **PostgreSQL Data**: `./conquertactoe-db/data/postgres`
- **ClickHouse Data**: `./autoplayer/data/clickhouse`
- **Backups**: `./backups/`

### Why Host Volumes?

✅ Data persists independently of containers  
✅ Easy access for backups without Docker commands  
✅ Direct file-level recovery possible  
✅ Survives `docker-compose down -v`  
✅ Can be backed up by standard filesystem tools

## Backup System

### Automated Backups

**Frequency**: Every 24 hours (2:00 AM)  
**Retention**: 7 days  
**Format**: 
- PostgreSQL: `postgres_YYYY-MM-DD_HHMMSS.sql.gz`
- ClickHouse: `clickhouse_YYYY-MM-DD_HHMMSS.tar.gz`

### Manual Backup

To create a backup immediately:

```bash
cd /Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe
./scripts/backup-db.sh
```

The script will:
1. Create compressed PostgreSQL dump
2. Create ClickHouse archive
3. Store in `./backups/` directory
4. Delete backups older than 7 days
5. Log all operations

### Setting Up Automated Backups

#### Option 1: Cron (macOS/Linux)

1. Edit the crontab file with your actual path:
```bash
nano scripts/crontab.txt
```

2. Install the crontab:
```bash
crontab scripts/crontab.txt
```

3. Verify installation:
```bash
crontab -l
```

4. View backup logs:
```bash
tail -f backups/backup.log
```

#### Option 2: launchd (macOS)

Create `~/Library/LaunchAgents/com.conquertactoe.backup.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.conquertactoe.backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/scripts/backup-db.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/backups/backup.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/sagol/Development/Projects/Conquer-Tac-Toe/Conquer-Tac-Toe/backups/backup-error.log</string>
</dict>
</plist>
```

Load the agent:
```bash
launchctl load ~/Library/LaunchAgents/com.conquertactoe.backup.plist
```

## Restore Procedures

### Restore PostgreSQL Only

```bash
./scripts/restore-db.sh postgres backups/postgres_2025-11-28_020000.sql.gz
```

### Restore ClickHouse Only

```bash
./scripts/restore-db.sh clickhouse backups/clickhouse_2025-11-28_020000.tar.gz
```

### Restore Both Databases

```bash
./scripts/restore-db.sh all \
    backups/postgres_2025-11-28_020000.sql.gz \
    backups/clickhouse_2025-11-28_020000.tar.gz
```

**⚠️ Warning**: Restore will REPLACE all current database data. You'll be prompted for confirmation.

## Migration from Docker Volumes to Host Volumes

If you're currently using Docker named volumes, follow these steps to migrate to host bind mounts:

### 1. Run Migration Script

```bash
./scripts/migrate-to-host-volumes.sh
```

The script will:
1. Stop all containers
2. Create host directories
3. Copy data from Docker volumes to host
4. Update docker-compose.yml files
5. Restart containers

**Estimated downtime**: 5-10 minutes

### 2. Verify Migration

1. Check application: http://localhost:3001
2. Test database connectivity
3. Verify data integrity

### 3. Cleanup (Optional)

If everything works correctly, remove old Docker volumes:

```bash
docker volume rm conquertactoe-db_pgdata
docker volume rm autoplayer_clickhouse_data
```

### 4. Remove Backup Files

```bash
cd conquertactoe/conquertactoe-db
rm docker-compose.yml.bak

cd ../conquertactoe-autoplayer  
rm docker-compose.yml.bak
```

## Monitoring

### Check Backup Status

```bash
# List all backups
ls -lh backups/

# View latest backup log
tail -20 backups/backup.log

# Check backup sizes
du -sh backups/*
```

### Verify Backup Health

```bash
# Test PostgreSQL backup integrity
gunzip -t backups/postgres_LATEST.sql.gz

# Check ClickHouse backup
tar -tzf backups/clickhouse_LATEST.tar.gz | head
```

## Disaster Recovery

### Complete System Failure

1. **Reinstall Docker and dependencies**
2. **Clone repository**:
```bash
git clone https://github.com/sagol/Conquer-Tac-Toe.git
cd Conquer-Tac-Toe/conquertactoe
```

3. **Restore from backup**:
```bash
# Copy your backups to ./backups/
./scripts/restore-db.sh all \
    backups/postgres_LATEST.sql.gz \
    backups/clickhouse_LATEST.tar.gz
```

4. **Start all services**:
```bash
docker network create conquer-network
./scripts/start-all.sh
```

### Partial Data Corruption

If only specific data is corrupted:

1. Stop affected service
2. Restore only that database
3. Restart service

## Backup Best Practices

✅ **Test restores regularly** - Verify backups work  
✅ **Monitor backup sizes** - Sudden changes may indicate issues  
✅ **Keep offsite copies** - Copy backups to cloud storage  
✅ **Document procedures** - Ensure team knows recovery steps  
✅ **Check logs weekly** - Review backup.log for errors

## Troubleshooting

### Backup Script Fails

**Problem**: "PostgreSQL container is not running"
```bash
# Check container status
docker ps | grep conquertactoe_db

# Start database
cd conquertactoe-db && docker-compose up -d
```

**Problem**: "Permission denied"
```bash
# Fix script permissions
chmod +x scripts/*.sh

# Fix backup directory
chmod 700 backups/
```

### Restore Fails

**Problem**: "Backup file not found"
```bash
# Verify file exists
ls -l backups/postgres_*.sql.gz

# Use absolute path
./scripts/restore-db.sh postgres /full/path/to/backup.sql.gz
```

### Cron Not Running

```bash
# Check if cron is running (macOS)
sudo launchctl list | grep cron

# Check crontab
crontab -l

# View system logs
grep CRON /var/log/system.log
```

## Security Considerations

- Backup directory has restricted permissions (700)
- Backups excluded from git (.gitignore)
- Consider encrypting backups with GPG for production
- Store credentials in .env, not in scripts
- Rotate backup encryption keys regularly

## Contact

For issues or questions:
- Check logs: `backups/backup.log`
- Review this guide
- Contact system administrator
