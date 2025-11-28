# Conquer-Tac-Toe Admin Dashboard

## 🛡️ Overview
The Admin Dashboard is a centralized interface for monitoring the system, managing users, and analyzing game data. It is built as a separate microservice stack to ensure isolation from the main game platform.

## 🚀 Current Status (Phase 1 Complete)

### ✅ Implemented Features
- **Authentication**: JWT-based auth with `AdminUsers` table.
- **User Management**: List users, view stats.
- **Game Management**: Monitor active games.
- **Analytics**: ClickHouse integration for game moves.
- **System Health**: Real-time status monitoring.
- **Logging**: Winston logger integration.

### 🚧 In Progress / Planned
- **User Ban System**: UI for banning users (Backend support ready).
- **Advanced Analytics**: More detailed charts and graphs.
- **Role Management**: Super admin features.

## 🛠️ Technology Stack
- **Frontend**: React 18, Material-UI, Recharts
- **Backend**: Node.js, Express, PostgreSQL, ClickHouse
- **Infrastructure**: Docker Compose

## 🔑 Access
- **Frontend**: http://localhost:3002
- **Backend**: http://localhost:4000
- **Default Admin**: `admin@conquertactoe.com` / `admin123`

## 📦 Installation
Run the start script from the project root:
```bash
./start-admin.sh
```

## 📝 API Documentation
See `backend/routes` for available endpoints.
- `POST /admin/auth/login`
- `GET /admin/users`
- `GET /admin/games`
- `GET /admin/analytics/moves`
