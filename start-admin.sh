#!/bin/bash

# Start Admin Dashboard
echo "Starting Admin Dashboard..."

cd conquertactoe/admin-dashboard
docker-compose up --build -d

echo "Admin Dashboard started!"
echo "Backend: http://localhost:4000"
echo "Frontend: http://localhost:3002"
