Certainly! Here is the detailed setup for both Linux and macOS hosts.

### Adjusted Initialization Script and Docker Configuration

**init-db/init.sql**

```sql
-- Drop existing tables
DROP TABLE IF EXISTS GameMoves;
DROP TABLE IF EXISTS Games;
DROP TABLE IF EXISTS Leaderboards;
DROP TABLE IF EXISTS Users;

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    oauth_id VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    profile_pic VARCHAR(255),
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    token VARCHAR(255), -- Add this line
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games Table
CREATE TABLE Games (
    game_id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES Users(user_id),
    player2_id INTEGER REFERENCES Users(user_id),
    winner_id INTEGER REFERENCES Users(user_id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GameMoves Table
CREATE TABLE GameMoves (
    move_id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES Games(game_id),
    player_id INTEGER REFERENCES Users(user_id),
    move_number INTEGER NOT NULL,
    cell_position INTEGER NOT NULL,
    cone_size VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboards Table
CREATE TABLE Leaderboards (
    leaderboard_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES Users(user_id),
    rank INTEGER NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    draws INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**init-db/init-db.sh**

```sh
#!/bin/bash

# Wait for PostgreSQL to start
sleep 10

# Run the SQL script to initialize the database
psql -U $POSTGRES_USER -d $POSTGRES_DB -p 5433 -f /docker-entrypoint-initdb.d/init.sql
```

**Dockerfile**

```dockerfile
FROM postgres:16.3

COPY init-db/init.sql /docker-entrypoint-initdb.d/
COPY init-db/init-db.sh /docker-entrypoint-initdb.d/

RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh
```

**docker-compose.yml**

```yaml
version: '3.8'

services:
  db:
    build: .
    container_name: conquertactoe_db
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db:/docker-entrypoint-initdb.d
    user: "999:999"  # Ensure the container uses the same UID and GID as the postgres user on the host

volumes:
  pgdata:
```

**.env**

Ensure the `.env` file contains the necessary environment variables.

```
POSTGRES_DB=conquertactoe
POSTGRES_USER=ct_user
POSTGRES_PASSWORD=secure_password
```

### Host Configuration

#### For Linux

Ensure the PostgreSQL user and data directory are created on the host machine:

1. **Create the postgres user and group on the host:**

```sh
sudo groupadd -g 999 postgres
sudo useradd -u 999 -g postgres -s /bin/bash -d /var/lib/postgresql postgres
```

2. **Create the data directory and set permissions:**

```sh
sudo mkdir -p /var/lib/postgresql/data
sudo chown -R postgres:postgres /var/lib/postgresql/data
```

#### For macOS

macOS uses different commands for creating users and groups. Here's how you can set it up:

1. **Create the postgres user and group on the host:**

```sh
sudo dscl . -create /Groups/postgres
sudo dscl . -create /Groups/postgres PrimaryGroupID 999
sudo dscl . -create /Users/postgres
sudo dscl . -create /Users/postgres UniqueID 999
sudo dscl . -create /Users/postgres PrimaryGroupID 999
sudo dscl . -create /Users/postgres UserShell /bin/bash
sudo dscl . -create /Users/postgres NFSHomeDirectory /var/lib/postgresql
```

2. **Create the data directory and set permissions:**

```sh
sudo mkdir -p /var/lib/postgresql/data
sudo chown -R 999:999 /var/lib/postgresql/data
```

### Running the Database

1. **Create the .env File:**

Ensure the `.env` file is in the same directory as `docker-compose.yml`.

2. **Build and Run the Docker Container:**

```sh
docker-compose up -d
```

3. **Accessing the Database:**

You can connect to the PostgreSQL database using any PostgreSQL client with the following credentials:
- Host: `localhost`
- Port: `5433`
- User: `${POSTGRES_USER}`
- Password: `${POSTGRES_PASSWORD}`
- Database: `${POSTGRES_DB}`

### Connecting to the Database

Use the following command to connect to the PostgreSQL database from the host machine:

```sh
psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -p 5433
```

### Verifying the Setup

Ensure that the tables are created correctly by running a few queries:

```sql
SELECT * FROM Users;
SELECT * FROM Games;
SELECT * FROM GameMoves;
SELECT * FROM Leaderboards;
```

This setup ensures that the PostgreSQL data directory and user are created and managed on the host machine, while Docker is used to run the PostgreSQL server. The database schema is recreated from scratch each time the container is started, ensuring a fresh setup.