# Deployment Guide

This document provides instructions for deploying DoKoHub to production using Docker Compose.

## Prerequisites

- Docker and Docker Compose
- Domain name (optional, but recommended for OAuth)
- Google OAuth credentials (for authentication)

## Deployment Steps

### 1. Clone the repository

```bash
git clone https://github.com/fpfuetsch/dokohub.git
cd dokohub
```

### 2. Create environment file

Copy the example environment file and edit it with your configuration:

```bash
cp .env.example .env
```

Edit `.env` and configure the following variables:

```bash
# Database Configuration
POSTGRES_USER=dokohub
POSTGRES_PASSWORD=<generate-secure-password>
POSTGRES_DB=dokohub
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}

# Application Configuration
APP_PORT=5173
APP_ORIGIN=https://example.net  # Your production URL

# Authentication Secrets (generate secure random strings)
AUTH_JWT_SECRET=<generate-random-secrets>
INVITATION_JWT_SECRET=<generate-random-secrets>

# Google OAuth Configuration
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

**Important Security Notes:**

- Generate strong random secrets for `AUTH_JWT_SECRET` and `INVITATION_JWT_SECRET`
- Use a strong password for `POSTGRES_PASSWORD`

### 3. Generate secrets

You can generate secure secrets using:

```bash
# For AUTH_JWT_SECRET, INVITATION_JWT_SECRET and POSTGRES_PASSWORD
openssl rand -base64 48
```

### 4. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URI: `https://example.net/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

### 5. Deploy with Docker Compose

```bash
docker compose up -d
```

This will:

- Start a PostgreSQL database
- Run database migrations
- Build and start the DoKoHub application
- Expose the app on `http://127.0.0.1:5173`

**Note:** For production, you should set up a reverse proxy (like Nginx or Caddy) to handle HTTPS and expose the application securely.

### 6. Verify deployment

Visit `http://127.0.0.1:5173` (or your domain if you've set up a reverse proxy) and verify that:

- The application loads correctly
- Google OAuth login works
- You can create groups and games
