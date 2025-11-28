# Conquer-Tac-Toe Admin Dashboard

## Technical Specification & Implementation Guide

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [API Specifications](#api-specifications)
5. [Frontend Architecture](#frontend-architecture)
6. [Security & Authentication](#security--authentication)
7. [Deployment & Infrastructure](#deployment--infrastructure)
8. [Implementation Phases](#implementation-phases)

---

## Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Admin      │  │    Admin     │  │  PostgreSQL  │      │
│  │  Frontend    │──│   Backend    │──│   Database   │      │
│  │  (Port 3002) │  │  (Port 4000) │  │  (Shared)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                                  │
│         │                 └──────────────────┐              │
│         │                                    │              │
│  ┌──────────────┐                  ┌──────────────┐        │
│  │  Main App    │                  │  ClickHouse  │        │
│  │  Backend     │                  │  (Analytics) │        │
│  └──────────────┘                  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles
- **Separation of Concerns**: Admin dashboard is completely isolated from main app
- **Shared Data Layer**: Uses same PostgreSQL database but with separate tables for admin functions
- **Security First**: Role-based access control, audit logging, rate limiting
- **Scalability**: Microservice-ready architecture
- **Observability**: Comprehensive logging and analytics

---

## Technology Stack

### Backend
- **Runtime**: Node.js 22.x
- **Framework**: Express.js 4.x
- **Database ORM**: Raw PostgreSQL queries (pg driver)
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Joi
- **Security**: Helmet, CORS, bcrypt
- **Rate Limiting**: express-rate-limit
- **Logging**: Winston
- **Port**: 4000

### Frontend
- **Framework**: React 18.x
- **UI Library**: Material-UI (MUI) v5
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Forms**: Formik + Yup
- **Port**: 3002

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL 16 (shared with main app)
- **Analytics DB**: ClickHouse (shared with autoplayer)
- **Reverse Proxy**: Nginx (production)

---

## Database Schema

### New Tables

#### 1. AdminLogs
```sql
CREATE TABLE AdminLogs (
    id SERIAL PRIMARY KEY,
    admin_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),  -- 'user', 'game', 'system'
    target_id INT,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_admin_logs_admin (admin_id),
    INDEX idx_admin_logs_created (created_at DESC),
    INDEX idx_admin_logs_action (action)
);
```

#### 2. UserBans
```sql
CREATE TABLE UserBans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    banned_by INT NOT NULL REFERENCES Users(user_id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    banned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_permanent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    unbanned_at TIMESTAMP,
    unbanned_by INT REFERENCES Users(user_id) ON DELETE SET NULL,
    unban_reason TEXT,
    INDEX idx_user_bans_user (user_id),
    INDEX idx_user_bans_active (is_active, expires_at)
);
```

#### 3. SystemLogs
```sql
CREATE TABLE SystemLogs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,  -- 'info', 'warning', 'error', 'critical'
    service VARCHAR(50) NOT NULL, -- 'backend', 'frontend', 'autoplayer'
    message TEXT NOT NULL,
    stack_trace TEXT,
    metadata JSONB,
    user_id INT REFERENCES Users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_system_logs_level (level),
    INDEX idx_system_logs_created (created_at DESC),
    INDEX idx_system_logs_service (service)
);
```

### Modified Tables

#### Users Table
```sql
ALTER TABLE Users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
-- Possible values: 'user', 'admin', 'super_admin'

ALTER TABLE Users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE Users ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0;

CREATE INDEX idx_users_role ON Users(role);
CREATE INDEX idx_users_banned ON Users(is_banned);
```

---

## API Specifications

### Base URL
`http://localhost:4000/admin`

### Authentication Endpoints

#### POST /admin/auth/login
**Request:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "admin": {
    "user_id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### POST /admin/auth/refresh
**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

#### POST /admin/auth/logout
**Headers:** `Authorization: Bearer {token}`

---

### User Management Endpoints

#### GET /admin/users
**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` (username or email)
- `role` (user|admin|super_admin)
- `is_banned` (true|false)
- `sort_by` (username|created_at|total_games)
- `sort_order` (asc|desc)

**Response:**
```json
{
  "users": [
    {
      "user_id": 123,
      "username": "player1",
      "email": "player1@example.com",
      "role": "user",
      "total_games": 50,
      "wins": 30,
      "losses": 15,
      "draws": 5,
      "is_banned": false,
      "created_at": "2024-01-15T10:30:00Z",
      "last_login_at": "2024-01-20T14:22:00Z"
    }
  ],
  "pagination": {
    "total": 1000,
    "page": 1,
    "limit": 50,
    "total_pages": 20
  }
}
```

#### GET /admin/users/:id
**Response:**
```json
{
  "user": {
    "user_id": 123,
    "username": "player1",
    "email": "player1@example.com",
    "role": "user",
    "total_games": 50,
    "wins": 30,
    "losses": 15,
    "draws": 5,
    "is_banned": false,
    "created_at": "2024-01-15T10:30:00Z",
    "last_login_at": "2024-01-20T14:22:00Z",
    "login_count": 127
  },
  "recent_games": [
    {
      "id": 456,
      "opponent": "player2",
      "result": "win",
      "created_at": "2024-01-20T12:00:00Z"
    }
  ],
  "ban_history": []
}
```

#### PUT /admin/users/:id
**Request:**
```json
{
  "username": "newusername",
  "email": "newemail@example.com",
  "role": "admin"
}
```

#### POST /admin/users/:id/ban
**Request:**
```json
{
  "reason": "Violation of terms",
  "expires_at": "2024-12-31T23:59:59Z",  // null for permanent
  "is_permanent": false
}
```

#### DELETE /admin/users/:id/ban
**Request:**
```json
{
  "reason": "Appeal approved"
}
```

#### DELETE /admin/users/:id
**Request:**
```json
{
  "confirm": true,
  "reason": "User requested account deletion"
}
```

---

### Game Management Endpoints

#### GET /admin/games
**Query Parameters:**
- `page`, `limit`
- `game_type` (pvp|bot)
- `status` (pending|joined|won|draw|cancelled|surrendered)
- `creator_id`
- `date_from`, `date_to`

**Response:**
```json
{
  "games": [
    {
      "id": 789,
      "creator": "player1",
      "joiner": "player2",
      "game_type": "pvp",
      "status": "won",
      "winner": 1,
      "created_at": "2024-01-20T10:00:00Z",
      "completed_at": "2024-01-20T10:15:00Z"
    }
  ],
  "pagination": {...}
}
```

#### GET /admin/games/:id
**Response:** Full game details including board state

#### DELETE /admin/games/:id
Delete game record (soft delete)

---

### Logs & Monitoring Endpoints

#### GET /admin/logs/system
**Query Parameters:**
- `level` (info|warning|error|critical)
- `service` (backend|frontend|autoplayer)
- `date_from`, `date_to`
- `search` (message content)

#### GET /admin/logs/admin-actions
**Response:** AdminLogs entries

#### GET /admin/logs/clickhouse
Query ClickHouse for bot game logs

---

### Analytics Endpoints

#### GET /admin/analytics/overview
**Response:**
```json
{
  "total_users": 5000,
  "active_users_today": 250,
  "total_games": 10000,
  "games_today": 150,
  "pvp_games_ratio": 0.65,
  "bot_games_ratio": 0.35,
  "new_users_this_week": 120
}
```

#### GET /admin/analytics/users
User growth, registrations over time

#### GET /admin/analytics/games
Game creation trends, completion rates

#### GET /admin/analytics/bot-performance
Bot win rates, difficulty distribution

---

## Frontend Architecture

### Page Structure
```
src/
├── pages/
│   ├── Dashboard.js         # Overview with KPIs
│   ├── Users/
│   │   ├── UserList.js      # User management table
│   │   ├── UserDetails.js   # User profile modal
│   │   └── UserActions.js   # Ban/edit forms
│   ├── Games/
│   │   ├── GameList.js
│   │   └── GameDetails.js
│   ├── Logs/
│   │   ├── SystemLogs.js
│   │   ├── AdminLogs.js
│   │   └── ClickHouseLogs.js
│   ├── Analytics/
│   │   ├── Overview.js
│   │   ├── UserAnalytics.js
│   │   ├── GameAnalytics.js
│   │   └── BotAnalytics.js
│   └── Login.js
├── components/
│   ├── Layout/
│   │   ├── Sidebar.js
│   │   ├── Navbar.js
│   │   └── Footer.js
│   ├── Charts/
│   │   ├── LineChart.js
│   │   ├── PieChart.js
│   │   └── BarChart.js
│   ├── Tables/
│   │   ├── DataTable.js      # Reusable table
│   │   └── Pagination.js
│   └── Modals/
│       ├── ConfirmDialog.js
│       └── FormModal.js
└── redux/
    ├── slices/
    │   ├── authSlice.js
    │   ├── usersSlice.js
    │   ├── gamesSlice.js
    │   └── analyticsSlice.js
    └── store.js
```

### Key Features

#### 1. Dashboard (Home Page)
- **KPI Cards**: Total users, active users, games today, bot usage percentage
- **Charts**:
  - User registrations (line chart, last 30 days)
  - Games per day (bar chart)
  - PvP vs Bot ratio (pie chart)
- **Recent Activity Feed**: Latest games, new users
- **Quick Actions**: Ban user, view logs, refresh data

#### 2. User Management
- **User Table**:
  - Columns: ID, Username, Email, Role, Games, Status, Created, Actions
  - Search by username/email
  - Filter by role, banned status
  - Sort by any column
  - Bulk actions (multi-select)
- **User Details Modal**:
  - Full profile information
  - Game history (last 50 games)
  - Ban history
  - Action buttons: Edit, Ban/Unban, Delete
- **Edit Form**: Update username, email, role
- **Ban Form**: Reason, expiration date, permanent option

#### 3. Game Management
- **Game List**:
  - Columns: ID, Players, Type, Status, Duration, Winner, Date
  - Filter by type, status, date range
  - Real-time status updates
- **Game Details**: Board visualization, move history

#### 4. Logs Viewer
- **Tabbed Interface**: System Logs | Admin Actions | Bot Logs
- **Features**:
  - Real-time log streaming (WebSocket)
  - Search and filter
  - Export to CSV
  - Severity color coding
  - Auto-scroll toggle

#### 5. Analytics
- **User Analytics**:
  - Registrations over time
  - Active users trend
  - Retention metrics
- **Game Analytics**:
  - Games per day
  - Completion rate
  - Average game duration
  - Win/Loss/Draw distribution
- **Bot Analytics**:
  - Bot usage percentage
  - Win rates by difficulty
  - Popular board positions

---

## Security & Authentication

### Authentication Flow
1. Admin logs in with email/password
2. Backend verifies credentials and role
3. JWT access token (1 hour expiry) + refresh token (7 days) returned
4. Frontend stores tokens in localStorage
5. Every API request includes Authorization header
6. Backend middleware verifies token and role on each request
7. Refresh token used to get new access token when expired

### Authorization Levels
- **user**: No admin access
- **admin**: Full read/write access to users, games, logs
- **super_admin**: All admin rights + user management (promote/demote admins)

### Middleware Stack
```javascript
// Every admin endpoint uses:
app.use('/admin', [
  rateLimiter,           // 100 requests per 15 minutes
  authenticateJWT,       // Verify JWT token
  requireAdmin,          // Check role is admin or super_admin
  auditLogger           // Log action to AdminLogs
]);
```

### Security Best Practices
- **Password Hashing**: bcrypt with salt rounds = 12
- **JWT Secrets**: Separate secret for admin tokens
- **CORS**: Whitelist admin frontend origin only
- **Helmet**: Security headers
- **Input Validation**: Joi schemas for all inputs
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Sanitize all inputs
- **Rate Limiting**: Strict limits on admin endpoints
- **Audit Trail**: Every action logged to AdminLogs

---

## Deployment & Infrastructure

### Docker Compose Configuration
See: `admin-dashboard/docker-compose.yml`

### Environment Variables

#### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/conquertactoe
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_PORT=9000

# JWT
ADMIN_JWT_SECRET=your-super-secret-admin-key-change-in-production
ADMIN_JWT_REFRESH_SECRET=your-super-secret-refresh-key
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# Server
PORT=4000
NODE_ENV=production

# Security
ALLOWED_ORIGINS=http://localhost:3002,https://admin.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

#### Frontend (.env)
```bash
REACT_APP_ADMIN_API_URL=http://localhost:4000/admin
REACT_APP_WEBSOCKET_URL=ws://localhost:4000
```

### Production Deployment
1. **Build Images**: `docker-compose build`
2. **Run Containers**: `docker-compose up -d`
3. **Nginx Reverse Proxy**: Route `/admin` to admin backend
4. **SSL**: Let's Encrypt certificates
5. **Monitoring**: Grafana + Prometheus for metrics

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
**Backend:**
- [x] Project structure setup
- [x] Express server with middleware
- [x] Database schema migrations
- [x] JWT authentication system
- [x] Admin role verification middleware
- [x] Audit logging middleware

**Frontend:**
- [x] React app initialization
- [x] Redux store setup
- [x] Material-UI theme configuration
- [x] Routing structure
- [x] Login page
- [x] Layout components (Sidebar, Navbar)

### Phase 2: User Management (Days 3-4)
**Backend:**
- [ ] User CRUD endpoints
- [ ] Ban/unban endpoints
- [ ] User search and filter logic

**Frontend:**
- [ ] User list page with table
- [ ] User details modal
- [ ] Edit user form
- [ ] Ban/unban dialogs
- [ ] Search and filter UI

### Phase 3: Game Management (Day 5)
**Backend:**
- [ ] Game list endpoint
- [ ] Game details endpoint
- [ ] Delete game endpoint

**Frontend:**
- [ ] Game list page
- [ ] Game details modal
- [ ] Board visualization component

### Phase 4: Logs & Monitoring (Day 6)
**Backend:**
- [ ] System logs aggregation
- [ ] Admin logs endpoint
- [ ] ClickHouse integration for bot logs
- [ ] WebSocket for real-time logs

**Frontend:**
- [ ] Log viewer component
- [ ] Real-time updates
- [ ] Search and filter
- [ ] Export functionality

### Phase 5: Analytics Dashboard (Day 7)
**Backend:**
- [ ] Analytics aggregation queries
- [ ] Overview stats endpoint
- [ ] User/Game/Bot analytics endpoints

**Frontend:**
- [ ] Dashboard with KPI cards
- [ ] Chart components (Recharts)
- [ ] Analytics pages

### Phase 6: Testing & Deploy (Day 8)
- [ ] Integration testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment

---

## Development Guidelines

### Code Style
- **ESLint**: Airbnb style guide
- **Prettier**: Automatic formatting
- **Comments**: JSDoc for functions

### Git Workflow
- **Branch**: `feature/admin-dashboard`
- **Commits**: Conventional commits format
- **PR**: Separate from main app features

### Testing
- **Backend**: Jest + Supertest
- **Frontend**: Jest + React Testing Library
- **E2E**: Cypress (optional)

---

## Additional Resources

### Documentation Files
- `/docs/API.md` - Complete API documentation
- `/docs/SETUP.md` - Development setup instructions
- `/docs/DEPLOYMENT.md` - Production deployment guide
- `/docs/SECURITY.md` - Security best practices

### Mockups & Designs
- `/docs/mockups/` - UI mockups (Figma links)

---

## Appendix

### Sample Data
SQL scripts for creating sample admin users and test data in `/backend/seeds/`

### Useful Commands
```bash
# Start development
docker-compose up

# Run migrations
npm run migrate

# Seed data
npm run seed

# Run tests
npm test

# Build for production
docker-compose -f docker-compose.prod.yml build
```

---

**Version**: 1.0.0  
**Last Updated**: 2024-11-24  
**Prepared For**: Conquer-Tac-Toe Admin Dashboard Implementation
