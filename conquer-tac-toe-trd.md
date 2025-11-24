# Technical Documentation

## Conquer-Tac-Toe

### Architecture Overview

Conquer-Tac-Toe is a strategic twist on the classic tic-tac-toe game, where players use cones of different sizes to outmaneuver their opponents. The project combines real-time multiplayer gaming with a modern tech stack to create an engaging and competitive experience.

### Key Features
- Real-time multiplayer gaming with Socket.io
- OAuth-based authentication with Google
- Leaderboard to track player performance
- Responsive and user-friendly frontend with Material-UI
- Backend with Express.js and PostgreSQL for data storage

### Tech Stack
- **Programming Language:** JavaScript
- **Frontend:** React, Material-UI, Redux, Socket.io-client
- **Backend:** Node.js, Express.js, Socket.io, Passport.js, PostgreSQL
- **Database:** PostgreSQL
- **Authentication:** OAuth with Google
- **Build Tools:** Docker, Nodemon, Webpack

### Setup & Installation

#### Prerequisites
- Node.js (v14 or later)
- Docker (if using Docker setup)
- PostgreSQL (if using Docker setup)

#### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/conquertactoe.git
   cd conquertactoe
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend:
   ```bash
   npm run dev
   ```

4. Start the frontend:
   ```bash
   npm start
   ```

#### Alternative Installation Methods
- **Using Docker:**
  ```bash
  docker-compose up --build
  ```

### API Documentation

#### Authentication
- **Google OAuth**
  - **Endpoint:** `/auth/google`
  - **Method:** `GET`
  - **Description:** Initiates Google OAuth authentication.
  - **Callback:** `/auth/google/callback`

- **Logout**
  - **Endpoint:** `/logout`
  - **Method:** `GET`
  - **Description:** Logs out the user.

- **Current User**
  - **Endpoint:** `/current_user`
  - **Method:** `GET`
  - **Description:** Returns the current authenticated user's information.

#### Game Requests
- **Create Game Request**
  - **Endpoint:** `/game-requests`
  - **Method:** `POST`
  - **Description:** Creates a new game request.
  - **Body:**
    ```json
    {
      "gameType": "classic"
    }
    ```

- **Get Active Game Requests**
  - **Endpoint:** `/game-requests`
  - **Method:** `GET`
  - **Description:** Retrieves all active game requests.

- **Join Game Request**
  - **Endpoint:** `/game-requests/:requestId/join`
  - **Method:** `POST`
  - **Description:** Joins an existing game request.
  - **Path Parameters:**
    - `requestId`: The ID of the game request to join.

- **Cancel Game Request**
  - **Endpoint:** `/game-requests/:requestId`
  - **Method:** `DELETE`
  - **Description:** Cancels a game request.
  - **Path Parameters:**
    - `requestId`: The ID of the game request to cancel.

- **Get Game Request by ID**
  - **Endpoint:** `/game-requests/:requestId`
  - **Method:** `GET`
  - **Description:** Retrieves details of a specific game request.
  - **Path Parameters:**
    - `requestId`: The ID of the game request.

- **Update Game Request**
  - **Endpoint:** `/game-requests/:gameId`
  - **Method:** `PUT`
  - **Description:** Updates a game request.
  - **Path Parameters:**
    - `gameId`: The ID of the game request to update.

- **Surrender Game**
  - **Endpoint:** `/game-requests/:gameId/surrender`
  - **Method:** `POST`
  - **Description:** Surrenders a game.
  - **Path Parameters:**
    - `gameId`: The ID of the game to surrender.

#### Leaderboard
- **Get Leaderboard**
  - **Endpoint:** `/leaderboard`
  - **Method:** `GET`
  - **Description:** Retrieves the leaderboard.

#### User
- **Get User by ID**
  - **Endpoint:** `/users/:id`
  - **Method:** `GET`
  - **Description:** Retrieves user information by ID.
  - **Path Parameters:**
    - `id`: The ID of the user.

- **Update User by ID**
  - **Endpoint:** `/users/:id`
  - **Method:** `PUT`
  - **Description:** Updates user information by ID.
  - **Path Parameters:**
    - `id`: The ID of the user.
  - **Body:**
    ```json
    {
      "username": "new_username"
    }
    ```

- **Get User Stats by ID**
  - **Endpoint:** `/users/:id/stats`
  - **Method:** `GET`
  - **Description:** Retrieves user statistics by ID.
  - **Path Parameters:**
    - `id`: The ID of the user.

### Database Schema

#### Users Table
```sql
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    oauth_id VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    profile_pic VARCHAR(255),
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Games Table
```sql
CREATE TABLE Games (
    game_id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES Users(user_id),
    player2_id INTEGER REFERENCES Users(user_id),
    winner_id INTEGER REFERENCES Users(user_id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### GameMoves Table
```sql
CREATE TABLE GameMoves (
    move_id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES Games(game_id),
    player_id INTEGER REFERENCES Users(user_id),
    move_number INTEGER NOT NULL,
    cell_position INTEGER NOT NULL,
    cone_size VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Leaderboards Table
```sql
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

#### GameRequests Table
```sql
CREATE TABLE GameRequests (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL,
  joiner_id INT,
  game_type VARCHAR(50),
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  board JSONB,
  active_player INTEGER,
  player1_cones JSONB,
  player2_cones JSONB,
  winner INTEGER
);
```

### Configuration

#### Environment Variables
- **POSTGRES_DB**
- **POSTGRES_USER**
- **POSTGRES_PASSWORD**
- **POSTGRES_HOST**
- **POSTGRES_PORT**
- **GOOGLE_CLIENT_ID**
- **GOOGLE_CLIENT_SECRET**
- **SESSION_SECRET**
- **PORT**
- **CLIENT_URL**

### Development Guidelines

- **Code Style:** Follow the Airbnb JavaScript Style Guide.
- **Testing:** Write unit tests for all components and services.
- **Code Reviews:** Conduct code reviews to ensure code quality and consistency.

### Deployment Instructions

1. **Build the Backend:**
   ```bash
   npm run build
   ```

2. **Build the Frontend:**
   ```bash
   npm run build
   ```

3. **Deploy the Backend:**
   - Use a cloud provider like AWS, Heroku, or DigitalOcean.
   - Ensure the environment variables are set correctly.

4. **Deploy the Frontend:**
   - Use a static file hosting service like Netlify, Vercel, or AWS Amplify.
   - Ensure the environment variables are set correctly.

5. **Database:**
   - Set up a PostgreSQL database.
   - Ensure the database schema is up-to-date.

6. **Domain and SSL:**
   - Set up a custom domain.
   - Configure SSL/TLS for secure communication.

### Conclusion

Conquer-Tac-Toe is a comprehensive project that combines real-time multiplayer gaming with a modern tech stack. The project is designed to be scalable, maintainable, and user-friendly. By following the setup and deployment instructions, developers can easily contribute to and deploy the project.