# Development Guide

This document contains setup instructions and development guidelines for DoKoHub.

## Prerequisites

- Node.js 24.x or higher
- Docker (for database setup) or PostgreSQL installed locally

## Setup Instructions

### 1. Create environment file

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration. See `.env.example` for all available options and documentation for each variable.

**Required variables:**

- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_JWT_SECRET` - Secret for authentication tokens
- `INVITATION_JWT_SECRET` - Secret for invitation tokens
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret

### 2. Start the development Postgres

```bash
docker compose -f dev.compose.yaml up -d
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run database migrations

```bash
npm run db:push
```

### 5. Start the development server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 7. (Optional) Install pre-commit hook

To automatically run tests and linting before each commit:

```bash
cp pre-commit .git/hooks/pre-commit
```

This will ensure code quality by running checks before allowing commits.

## Available Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run test            # Run tests in watch mode
npm run test -- --run   # Run tests once

# Code Quality
npm run check           # Type check with svelte-check
npm run lint            # Check code formatting
npm run format          # Format code with Prettier

# Database
npm run db:push         # Push schema changes
npm run db:generate     # Generate migration files
npm run db:migrate      # Run migrations
npm run db:studio       # Open Drizzle Studio
```

## Database Management

### Working with Migrations

- **Generate migration**: `npm run db:generate`
- **Apply migrations**: `npm run db:push`
- **Reset database**: Delete data and run `npm run db:push` again
- **Inspect database**: `npm run db:studio` to open Drizzle Studio UI

## Testing

Tests use Vitest with an in-memory PGlite database for isolation. No external database connection is needed for testing.

```bash
# Run tests in watch mode
npm run test

# Run tests once (CI mode)
npm run test -- --run

# Run specific test file
npm run test -- src/lib/domain/game.test.ts
```
