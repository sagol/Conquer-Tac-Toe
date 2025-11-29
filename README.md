# Conquer-Tac-Toe 🎮

A modern, strategic multiplayer game platform featuring multiple tic-tac-toe variants with real-time gameplay, AI opponents, and competitive leaderboards.

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

Conquer-Tac-Toe is a strategic evolution of classic tic-tac-toe, featuring:
- **Multiple Game Variants**: Classic Tic-Tac-Toe, Gomoku (15x15), and Conquer variants with sized cones
- **Real-time Multiplayer**: Play against friends or random opponents with Socket.io
- **AI Opponents**: Advanced bot system with variant-specific strategies
- **Competitive Leaderboards**: Track your performance across PvP and bot games
- **Modern UI**: Responsive glassmorphism design with smooth animations

## ✨ Features

- 🎯 **5 Game Variants**
  - Classic Tic-Tac-Toe (3x3)
  - Gomoku / Five-in-a-Row (15x15)
  - Conquer Classic, Conquer Chaos, and Conquer Custom
- 🤖 **Advanced AI System**
  - Minimax algorithm for Classic and Gomoku
  - Pattern recognition and heuristic evaluation
  - Variant-specific bot strategies
- 🔒 **Authentication**
  - Google OAuth integration
  - Dev login for testing
- � **Player Statistics**
  - Separate PvP and Bot leaderboards
  - Detailed player profiles
  - Win rate tracking
- 🌐 **Real-time Gameplay**
  - Socket.io for instant updates
  - Live game requests and moves
- � **Game Analytics**
  - ClickHouse for move logging
  - Performance metrics

## 🛠️ Tech Stack

### Frontend
- React 18 with Hooks
- Redux for state management
- Material-UI for components
- Socket.io-client for real-time updates
- Axios for API calls

### Backend
- Node.js with Express.js
- PostgreSQL for game data
- Socket.io for real-time communication
- Passport.js for OAuth authentication

### AI System
- Python 3.11 with FastAPI
- ClickHouse for move analytics
- Variant-specific bot implementations

### Infrastructure
- Docker & Docker Compose
- Multi-container architecture
- Network isolation
- **Persistent Data Storage**: Host-based volumes for databases

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Environment                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    conquer-network                      │   │
│  │                                                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │ Frontend │  │ Backend  │  │Autoplayer│             │   │
│  │  │ (React)  │──│(Node.js) │──│ (Python) │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘             │   │
│  │       │              │              │                   │   │
│  │       └──────────────┼──────────────┘                   │   │
│  │                      │                                   │   │
│  │         ┌────────────┴────────────┐                     │   │
│  │         │                         │                     │   │
│  │  ┌──────▼─────┐          ┌───────▼────┐                │   │
│  │  │ PostgreSQL │          │ ClickHouse │                │   │
│  │  │ Container  │          │ Container  │                │   │
│  │  └──────┬─────┘          └───────┬────┘                │   │
│  └─────────┼────────────────────────┼─────────────────────┘   │
│            │                        │                          │
│      bind mount                bind mount                      │
│            │                        │                          │
└────────────┼────────────────────────┼──────────────────────────┘
             ▼                        ▼
        ┌─────────┐              ┌─────────┐
        │  Host   │              │  Host   │
        │ Volume  │              │ Volume  │
        │/postgres│              │/clickhouse│
        └─────────┘              └─────────┘
     (Physical Server)       (Physical Server)
```

### Database Architecture

#### PostgreSQL (Main Database)
- **Container**: `conquertactoe_db`
- **Storage**: Host directory `./conquertactoe-db/data/postgres`
- **Port**: 5433 (host) → 5432 (container)
- **Purpose**: Application data (users, games, settings, leaderboards)

**Why Host Storage?**
- ✅ Data persists independently of containers
- ✅ Easy access for backups without Docker commands
- ✅ Direct file-level recovery possible
- ✅ Survives `docker-compose down -v`
- ✅ Can be backed up by standard filesystem tools

#### ClickHouse (Analytics Database)
- **Container**: `conquertactoe_clickhouse`
- **Storage**: Host directory `./autoplayer/data/clickhouse`
- **Ports**: 8123 (HTTP), 9000 (Native)
- **Purpose**: Move logging and analytics

### Data Flow

1. **Write Path**: 
   ```
   Frontend → Backend API → PostgreSQL Container → Host Volume
   ```

2. **Read Path**:
   ```
   Host Volume → PostgreSQL Container → Backend API → Frontend
   ```

3. **Analytics Path**:
   ```
   Autoplayer → ClickHouse Container → Host Volume
   ```

### Backup System

- **Frequency**: Every 24 hours (2 AM)
- **Retention**: Last 7 backups
- **Location**: `./backups/`
- **Format**: `.sql.gz` (PostgreSQL), `.tar.gz` (ClickHouse)
- **Automation**: Cron job or Docker scheduler

## 📦 Prerequisites

Before installation, ensure you have:

- **Docker Desktop** (v20.10 or later)
- **Docker Compose** (v2.0 or later)
- **Git** for cloning the repository
- **Google OAuth Credentials** (for production)

### System Requirements
- **OS**: macOS, Linux, or Windows with WSL2
- **RAM**: Minimum 4GB, recommended 8GB
- **Disk Space**: ~2GB for Docker images

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/sagol/Conquer-Tac-Toe.git
cd Conquer-Tac-Toe/conquertactoe
```

### 2. Set Up Docker Network

Create a shared Docker network for all services:

```bash
docker network create conquer-network
```

### 3. Configure Environment Variables

#### Backend Configuration

Create `conquertactoe-backend/.env` from the example:

```bash
cd conquertactoe-backend
cp .env-example .env
```

Edit `.env` with your settings:

```env
# Database Configuration
POSTGRES_DB=conquertactoe
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_HOST=conquertactoe_db
POSTGRES_PORT=5432

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Session Security
SESSION_SECRET=your_random_session_secret_min_32_chars

# Server Configuration
PORT=3000
CLIENT_URL=http://localhost:3001
```

#### Frontend Configuration

Create `conquertactoe-frontend/.env`:

```bash
cd ../conquertactoe-frontend
cp .env-example .env
```

Edit `.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:3000
```

#### Database Configuration

Create `conquertactoe-db/.env`:

```bash
cd ../conquertactoe-db
cp .env-example .env
```

Edit `.env` (must match backend POSTGRES_* values):

```env
POSTGRES_DB=conquertactoe
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here
```

#### Autoplayer (AI) Configuration

Create `conquertactoe-autoplayer/.env`:

```bash
cd ../conquertactoe-autoplayer
cp .env-example .env
```

Edit `.env`:

```env
# ClickHouse Configuration
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_PORT=9000
CLICKHOUSE_DB=default
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=

# Leave password empty for development
# For production, set a strong password
```

#### ClickHouse User Configuration

Create `conquertactoe-autoplayer/clickhouse-config/users.xml`:

```bash
cd clickhouse-config
cp users-example.xml users.xml
```

For development, the default configuration in `users-example.xml` is sufficient.

### 4. Database Storage Configuration

**Important**: By default, databases use Docker volumes. For production or easier backups, it's recommended to use host-based storage.

#### Option A: Docker Volumes (Default)

No additional configuration needed. Data is stored in Docker-managed volumes:
- PostgreSQL: `conquertactoe-db_pgdata`
- ClickHouse: `autoplayer_clickhouse_data`

#### Option B: Host-Based Volumes (Recommended)

For direct filesystem access and easier backups:

1. **Create data directories**:
```bash
mkdir -p conquertactoe-db/data/postgres
mkdir -p conquertactoe-autoplayer/data/clickhouse
```

2. **Update `conquertactoe-db/docker-compose.yml`**:
```yaml
volumes:
  - ./data/postgres:/var/lib/postgresql/data  # Instead of pgdata:/var/lib/postgresql/data
```

3. **Update `conquertactoe-autoplayer/docker-compose.yml`**:
```yaml
volumes:
  - ./data/clickhouse:/var/lib/clickhouse  # Instead of clickhouse_data:/var/lib/clickhouse
```

4. **Remove volume definitions** from both docker-compose files:
```yaml
# Remove these lines:
volumes:
  pgdata:
  # or
  clickhouse_data:
```

**Or use the migration script** (if already running with Docker volumes):
```bash
./scripts/migrate-to-host-volumes.sh
```

### 5. Start All Services

From the `conquertactoe` directory, start each service:

#### Start Database

```bash
cd conquertactoe-db
docker-compose up --build -d
cd ..
```

#### Start Backend

```bash
cd conquertactoe-backend
docker-compose up --build -d
cd ..
```

#### Start Frontend

```bash
cd conquertactoe-frontend
docker-compose up --build -d
cd ..
```

#### Start Autoplayer (AI System)

```bash
cd conquertactoe-autoplayer
docker-compose up --build -d
cd ../..
```

### 5. Verify All Containers

Check that all 5 containers are running:

```bash
docker ps --filter "name=conquertactoe"
```

Expected output:
```
NAMES                      STATUS          PORTS
conquertactoe_db           Up X seconds    0.0.0.0:5433->5432/tcp
conquertactoe_backend      Up X seconds    0.0.0.0:3000->3000/tcp
conquertactoe_frontend     Up X seconds    0.0.0.0:3001->3000/tcp
conquertactoe_autoplayer   Up X seconds    0.0.0.0:8000->8000/tcp
conquertactoe_clickhouse   Up X seconds    0.0.0.0:8123->8123/tcp, 0.0.0.0:9000->9000/tcp
```

### 6. Access the Application

Open your browser and navigate to:

**http://localhost:3001**

You should see the Conquer-Tac-Toe login page!

## 🔧 Container Details

### Database (PostgreSQL)
- **Container**: `conquertactoe_db`
- **Port**: `5433:5432`
- **Purpose**: Stores game data, user accounts, leaderboards
- **Location**: `conquertactoe-db/`

### Backend (Node.js/Express)
- **Container**: `conquertactoe_backend`
- **Port**: `3000:3000`
- **Purpose**: REST API, authentication, game logic
- **Location**: `conquertactoe-backend/`

### Frontend (React)
- **Container**: `conquertactoe_frontend`
- **Port**: `3001:3000`
- **Purpose**: User interface, client-side game board
- **Location**: `conquertactoe-frontend/`

### Autoplayer (Python/FastAPI)
- **Container**: `conquertactoe_autoplayer`
- **Port**: `8000:8000`
- **Purpose**: AI bot system for all game variants
- **Location**: `conquertactoe-autoplayer/`

### Admin Dashboard
- **Frontend**: `http://localhost:3002`
- **Backend**: `http://localhost:4000`
- **Purpose**: System monitoring, user management, game analytics
- **Location**: `conquertactoe/admin-dashboard/`
- **Start Script**: `./start-admin.sh`

### ClickHouse
- **Container**: `conquertactoe_clickhouse`
- **Ports**: `8123:8123`, `9000:9000`
- **Purpose**: Analytics database for game move logging
- **Managed by**: Autoplayer service

## 🔄 Redeployment After Updates

### Update All Containers

When you pull new code changes, rebuild and restart all services:

```bash
cd /path/to/Conquer-Tac-Toe/conquertactoe

# Frontend
cd conquertactoe-frontend
docker-compose down && docker-compose up --build -d
cd ..

# Backend
cd conquertactoe-backend
docker-compose down && docker-compose up --build -d
cd ..

# Autoplayer
cd conquertactoe-autoplayer
docker-compose down && docker-compose up --build -d
cd ../..

# Database (only if schema changed)
cd conquertactoe-db
docker-compose down && docker-compose up --build -d
cd ..
```

### Update Single Container

To update only one service (e.g., frontend):

```bash
cd conquertactoe-frontend
docker-compose down
docker-compose up --build -d
```

### Database Migrations

If database schema changes are included in the update:

```bash
cd conquertactoe-db
docker-compose down -v  # Remove volumes
docker-compose up --build -d
```

⚠️ **Warning**: This will delete all data! Backup first if needed.

## 📁 Project Structure

```
Conquer-Tac-Toe/
├── conquertactoe/
│   ├── conquertactoe-backend/          # Node.js Backend
│   │   ├── src/
│   │   │   ├── controllers/            # API controllers
│   │   │   ├── models/                 # Database models
│   │   │   ├── routes/                 # Express routes
│   │   │   ├── utils/                  # Game logic utilities
│   │   │   ├── config/                 # Configuration
│   │   │   └── middleware/             # Auth & validation
│   │   ├── .env-example
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── package.json
│   │
│   ├── conquertactoe-frontend/         # React Frontend
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/             # React components
│   │   │   │   ├── Auth/               # Login components
│   │   │   │   ├── GameBoard/          # Game UI
│   │   │   │   ├── Lobby/              # Game lobby
│   │   │   │   ├── Leaderboard/        # Rankings
│   │   │   │   └── Profile/            # User profiles
│   │   │   ├── redux/                  # State management
│   │   │   ├── App.js
│   │   │   └── index.js
│   │   ├── .env-example
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── package.json
│   │
│   ├── conquertactoe-db/               # PostgreSQL Database
│   │   ├── init-db/
│   │   │   ├── init.sql                # Schema & seed data
│   │   │   └── init-db.sh              # Initialization script
│   │   ├── .env-example
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   │
│   └── conquertactoe-autoplayer/       # Python AI System
│       ├── bots/                       # Bot implementations
│       │   ├── classic/                # Classic TicTacToe bot
│       │   ├── gomoku/                 # Gomoku bot
│       │   └── conquer/                # Conquer variants bot
│       ├── core/                       # Bot framework
│       │   ├── bot_interface.py        # IBot interface
│       │   └── bot_factory.py          # Bot registry
│       ├── clickhouse-config/
│       │   ├── users.xml               # ClickHouse config
│       │   └── users-example.xml       # Example config
│       ├── .env-example
│       ├── main.py                     # FastAPI application
│       ├── db.py                       # ClickHouse client
│       ├── requirements.txt
│       ├── Dockerfile
│       └── docker-compose.yml
│
├── README.md
└── TEST_SCENARIOS.md
```

## 🎮 Game Variants

### 1. Classic Tic-Tac-Toe
- **Board**: 3x3
- **Win Condition**: 3 in a row
- **Special Rules**: No overwriting

### 2. Gomoku (Five-in-a-Row)
- **Board**: 15x15 (customizable)
- **Win Condition**: 5 in a row
- **Special Rules**: No size mechanics

### 3. Conquer Classic
- **Board**: 3x3
- **Win Condition**: 3 in a row
- **Cones**: 3 small, 3 medium, 3 large per player
- **Special Rules**: Larger cones can overwrite smaller ones

### 4. Conquer Chaos
- **Board**: 3x3
- **Cones**: 3 small, 3 medium, 2 large per player
- **Special Rules**: Asymmetric cone distribution

### 5. Conquer Custom
- **Board**: 3x3
- **Cones**: Customizable (0-5 of each size)
- **Special Rules**: Player-defined cone inventory

## 🔐 Authentication Setup

### Google OAuth Configuration

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing

2. **Enable OAuth2 API**
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"

3. **Configure OAuth Consent Screen**
   - Add app name, logo, and support email
   - Add authorized domains: `localhost` (for dev)

4. **Set Redirect URIs**
   - Authorized JavaScript origins: `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`

5. **Get Credentials**
   - Copy Client ID and Client Secret
   - Add to `conquertactoe-backend/.env`

### Dev Login (For Testing)

The app includes a dev login feature that bypasses OAuth. To enable/disable:

1. Access the database:
   ```bash
   docker exec -it conquertactoe_db psql -U postgres -d conquertactoe
   ```

2. Toggle dev login:
   ```sql
   -- Enable
   UPDATE "AppConfig" SET config_value = 'true' WHERE config_key = 'ENABLE_DEV_LOGIN';
   
   -- Disable
   UPDATE "AppConfig" SET config_value = 'false' WHERE config_key = 'ENABLE_DEV_LOGIN';
   ```

3. Exit: `\q`

## � Troubleshooting

### Containers Won't Start

**Check Docker network exists:**
```bash
docker network ls | grep conquer-network
```

If not found, create it:
```bash
docker network create conquer-network
```

**Check port conflicts:**
```bash
# Check if ports are already in use
lsof -i :3000  # Backend
lsof -i :3001  # Frontend
lsof -i :5433  # Database
lsof -i :8000  # Autoplayer
```

### Database Connection Errors

**Verify database is running:**
```bash
docker logs conquertactoe_db
```

**Test connection:**
```bash
docker exec -it conquertactoe_db psql -U postgres -d conquertactoe -c "SELECT 1;"
```

### Frontend Can't Connect to Backend

**Check CORS settings** in `conquertactoe-backend/src/config/corsConfig.js`

**Verify environment variables:**
```bash
docker exec conquertactoe_frontend printenv | grep REACT_APP_BACKEND_URL
```

### AI Bot Not Responding

**Check autoplayer logs:**
```bash
docker logs conquertactoe_autoplayer --tail 50
```

**Test autoplayer health:**
```bash
curl http://localhost:8000/health
```

Expected response: `{"status":"ok"}`

### ClickHouse Connection Issues

**Check ClickHouse is running:**
```bash
docker logs conquertactoe_clickhouse --tail 50
```

**Verify data is being logged:**
```bash
docker exec conquertactoe_clickhouse clickhouse-client --query "SELECT COUNT(*) FROM game_moves"
```

## 🧪 Testing

### Manual Testing

1. **Create a game**: Click "Create Game Request" in the Lobby
2. **Play vs Bot**: Select any variant and "Play vs AI Bot"
3. **Check Leaderboard**: Navigate to Leaderboard after playing games
4. **View Profile**: Check your stats in the Profile section

### API Testing

Test backend endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Public config
curl http://localhost:3000/api/config/public

# Active games (requires auth)
curl http://localhost:3000/game-requests -H "Cookie: your_session_cookie"
```

### Bot Testing

Test AI system directly:

```bash
# Health check
curl http://localhost:8000/health

# Get bot move (POST request with game state)
curl -X POST http://localhost:8000/move \
  -H "Content-Type: application/json" \
  -d '{"variant_id": 1, "board": [[null,null,null],[null,null,null],[null,null,null]], "player_cones": [3,3,3], "bot_cones": [3,3,3]}'
```

## 📊 Monitoring & Logs

### View Container Logs

```bash
# Backend
docker logs -f conquertactoe_backend

# Frontend
docker logs -f conquertactoe_frontend

# Autoplayer
docker logs -f conquertactoe_autoplayer

# Database
docker logs -f conquertactoe_db

# ClickHouse
docker logs -f conquertactoe_clickhouse
```

### Check Container Status

```bash
docker ps --filter "name=conquertactoe" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Resource Usage

```bash
docker stats --filter "name=conquertactoe"
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**
5. **Commit**: `git commit -m 'Add amazing feature'`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Follow existing code style (ESLint/Prettier for JS, Black for Python)
- Write clear commit messages
- Add tests for new features
- Update documentation
- Ensure all containers build successfully

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Taras Baranyuk** - Initial work

## 🙏 Acknowledgments

- Material-UI for the component library
- Socket.io for real-time communication
- FastAPI for the Python backend framework
- All contributors and players!

---

**Need Help?** Open an issue on [GitHub](https://github.com/sagol/Conquer-Tac-Toe/issues)

**Questions?** Contact: support@gurudo.com
