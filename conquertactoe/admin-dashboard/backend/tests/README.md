# Admin Dashboard Tests

This directory contains comprehensive tests for the Admin Dashboard settings and enforcement.

## Test Files

- **settings.test.js** - Tests for Admin Settings API (GET, PUT)
- **maintenance-mode.test.js** - Tests for maintenance mode enforcement
- **registrations.test.js** - Tests for new registrations blocking
- **game-creation.test.js** - Tests for game creation blocking  
- **dev-login.test.js** - Tests for dev login visibility control

## Running Tests

### Prerequisites
Make sure both backend and admin backend are running:
```bash
# From project root
cd conquertactoe/conquertactoe-backend
docker-compose up -d

cd ../admin-dashboard
docker-compose up -d
```

### Install Dependencies
```bash
cd tests
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test
```bash
npm test maintenance-mode.test.js
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode (for development)
```bash
npm run test:watch
```

## Test Environment Variables

You can override the default URLs for testing:
```bash
BACKEND_URL=http://localhost:3000 ADMIN_URL=http://localhost:4000 npm test
```

## Notes

- Tests use a 30-second timeout to account for cache TTL (30 seconds)
- Some tests have 1-second delays to allow settings cache to update
- Tests clean up after themselves (reset settings to defaults)
- Admin credentials: `admin@conquertactoe.com` / `admin123`
