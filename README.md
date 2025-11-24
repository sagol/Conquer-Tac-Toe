# Conquer-Tac-Toe

## 🚀 Overview
Conquer-Tac-Toe is a strategic twist on the classic tic-tac-toe game, where players use cones of different sizes to outmaneuver their opponents. This project combines real-time multiplayer gaming with a modern tech stack to create an engaging and competitive experience.

### Key Features
- Real-time multiplayer gaming with Socket.io
- OAuth-based authentication with Google
- Leaderboard to track player performance
- Responsive and user-friendly frontend with Material-UI
- Backend with Express.js and PostgreSQL for data storage

### Who This Project Is For
- Gamers who enjoy strategic games
- Developers interested in real-time multiplayer games
- Anyone looking to contribute to an open-source project

## ✨ Features
- 🎮 Real-time multiplayer gaming
- 🔒 OAuth-based authentication
- 🏆 Leaderboard to track player performance
- 🌐 Responsive and user-friendly frontend
- 💻 Modern tech stack with Node.js, Express.js, and PostgreSQL

## 🛠️ Tech Stack
- **Programming Language:** JavaScript
- **Frontend:** React, Material-UI, Redux, Socket.io-client
- **Backend:** Node.js, Express.js, Socket.io, Passport.js, PostgreSQL
- **Database:** PostgreSQL
- **Authentication:** OAuth with Google
- **Build Tools:** Docker, Nodemon, Webpack

## 📦 Installation

### Prerequisites
- Node.js (v14 or later)
- Docker (if using Docker setup)
- PostgreSQL (if using Docker setup)

### Quick Start
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

### Alternative Installation Methods
- **Using Docker:**
  ```bash
  docker-compose up --build
  ```

## 🎯 Usage

### Basic Usage
```javascript
// Example of making a game request
axios.post('/game-requests', {
  gameType: 'classic'
})
.then(response => {
  console.log('Game request created:', response.data);
})
.catch(error => {
  console.error('Error creating game request:', error);
});
```

### Advanced Usage
- **Joining a Game:**
  ```javascript
  axios.post('/game-requests/:requestId/join', {
    gameType: 'classic'
  })
  .then(response => {
    console.log('Joined game:', response.data);
  })
  .catch(error => {
    console.error('Error joining game:', error);
  });
  ```

## 📁 Project Structure
```
conquertactoe/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── app.js
│   │   ├── server.js
│   │   └── socket.js
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── redux/
│   │   ├── App.js
│   │   ├── index.js
│   │   └── theme.js
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
├── db/
│   ├── init-db/
│   │   ├── init-db.sh
│   │   └── init.sql
│   ├── Dockerfile
│   └── docker-compose.yml
├── README.md
└── package.json
```

## 🔧 Configuration
- **Environment Variables:**
  - `.env` file in the root directory
  - Example:
    ```env
    POSTGRES_DB=conquertactoe
    POSTGRES_USER=youruser
    POSTGRES_PASSWORD=yourpassword
    POSTGRES_HOST=localhost
    POSTGRES_PORT=5432
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    SESSION_SECRET=your_session_secret
    PORT=3000
    CLIENT_URL=http://localhost:3001
    ```

## 🤝 Contributing
- Fork the repository
- Create a new branch for your feature or bug fix
- Make your changes and commit them
- Push your changes to your fork
- Create a pull request

### Development Setup
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

### Code Style Guidelines
- Follow the Airbnb JavaScript style guide
- Use consistent indentation and spacing
- Write clear and concise comments

### Pull Request Process
- Ensure your code is well-tested
- Write clear and concise commit messages
- Address any feedback from reviewers

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors & Contributors
- **Taras Baranyuk** - [@yourusername](https://github.com/yourusername)
- **Contributors:** [List of contributors]

## 🐛 Issues & Support
- Report issues on the [GitHub Issues page](https://github.com/yourusername/conquertactoe/issues)
- For support, contact [yourusername](mailto:yourusername@example.com)

## 🗺️ Roadmap
- **Planned Features:**
  - Implement more game types
  - Add user profiles and customization
  - Improve leaderboard UI
- **Known Issues:**
  - [Issue 1](https://github.com/yourusername/conquertactoe/issues/1)
  - [Issue 2](https://github.com/yourusername/conquertactoe/issues/2)
- **Future Improvements:**
  - Add mobile support
  - Improve performance and scalability

---

**Badges:**
[![Build Status](https://travis-ci.com/yourusername/conquertactoe.svg?branch=main)](https://travis-ci.com/yourusername/conquertactoe)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/yourusername/conquertactoe?style=social)](https://github.com/yourusername/conquertactoe)
[![GitHub forks](https://img.shields.io/github/forks/yourusername/conquertactoe?style=social)](https://github.com/yourusername/conquertactoe)

**Additional Guidelines:**
- Use modern markdown features (badges, collapsible sections, etc.)
- Include practical, working code examples
- Make it visually appealing with appropriate emojis
- Ensure all code snippets are syntactically correct for JavaScript
- Include relevant badges (build status, version, license, etc.)
- Make installation instructions copy-pasteable
- Focus on clarity and developer experience
