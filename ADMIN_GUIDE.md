# Admin Dashboard Guide 🛡️

The Conquer-Tac-Toe Admin Dashboard provides a centralized interface for monitoring the system, managing users, and analyzing game data.

## 🚀 Getting Started

### Prerequisites
- The main Conquer-Tac-Toe stack must be running (Database and ClickHouse are required).

### Start the Dashboard
Run the helper script from the project root:
```bash
./start-admin.sh
```

This will start:
- **Admin Backend** on port `4000`
- **Admin Frontend** on port `3002`

Access the dashboard at: **http://localhost:3002**

## 📊 Features

### 1. Dashboard Overview
- **System Status**: Real-time health check of the Admin Backend, PostgreSQL, and ClickHouse.
- **Uptime**: Server uptime monitoring.
- **Quick Stats**: Total moves analyzed and total games processed by the analytics engine.

### 2. User Management
- **List Users**: View all registered users with their registration date and email.
- **User Stats**: See win/loss/draw records for each user.
- **Delete User**: Ban/Delete users who violate rules (Hard delete from database).

### 3. Game Management
- **Active Games**: Monitor currently running and recently finished games.
- **Game Details**: View creator, joiner, variant, and current status.
- **Cancel Game**: Forcefully cancel/delete a game if needed (e.g., stuck games).

### 4. Analytics
- **Move History**: View a timeline of recent moves across all games.
- **Activity Charts**: Visual representation of game activity over time.
- **Data Source**: Powered by ClickHouse for high-performance analytics.

## 🛠️ Architecture

The Admin Dashboard is built as a separate microservice stack to ensure it doesn't impact the main game performance.

- **Frontend**: React, Material-UI, Recharts
- **Backend**: Express.js, Node.js
- **Database Access**: 
  - Direct connection to `conquertactoe_db` (PostgreSQL) for operational data.
  - Direct connection to `conquertactoe_clickhouse` for analytical data.

## 🔒 Security Note
- The dashboard currently runs in development mode.
- For production, ensure `ADMIN_JWT_SECRET` is set in `docker-compose.yml`.
- Implement proper authentication middleware (currently open for MVP).

## 🛑 Stopping the Dashboard
To stop the admin services:
```bash
cd conquertactoe/admin-dashboard
docker-compose down
```
