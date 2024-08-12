#!/bin/bash

# Log the start of the script
echo "Starting database initialization script..."

# Wait for PostgreSQL to start
sleep 10

# Run the SQL script to initialize the database
psql -U $POSTGRES_USER -d $POSTGRES_DB -p 5433 -f /docker-entrypoint-initdb.d/init.sql

# Log the completion of the script
echo "Database initialization script completed."
