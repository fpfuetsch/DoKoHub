# Deployment Guide

This document provides instructions for deploying DoKoHub to production using Docker Compose.

## Prerequisites

- Docker and Docker Compose
- Domain name + TLS Certificates
- Reverse Proxy to expose the app
- Google OAuth credentials (for authentication)

## Deployment Options

### Option 1: Use Prebuilt Image from GitHub Registry

1. Download the example compose.yaml and .env file:

   ```bash
   curl -o compose.yaml https://raw.githubusercontent.com/fpfuetsch/dokohub/main/example.compose.yaml && \
   curl -o .env https://raw.githubusercontent.com/fpfuetsch/dokohub/main/.env.example
   ```

1. Fill `.env` file (see [Prepare Environment File](#prepare-environment-file) below)

1. Optional: Edit `compose.yaml` to use the desired image tag:

   ```yaml
   services:
     app:
   	 image: ghcr.io/fpfuetsch/dokohub:<tag>
   ```

1. Deploy:
   ```bash
   docker compose up -d
   ```

### Option 2: Build from Source

1. Clone the repository:

   ```bash
   git clone https://github.com/fpfuetsch/dokohub.git
   cd dokohub
   ```

2. Copy .env.example

   ```bash
   cp .env.example .env
   ```

3. Fill `.env` file (see [Prepare Environment File](#prepare-environment-file) below)

4. Build and deploy:
   ```bash
   docker compose build
   docker compose up -d
   ```

## Expose deployment

For production, set up a reverse proxy like NGINX for HTTPS to expose the local app port.

## Setup Database Backups

Regularly back up the Postgres DB to prevent data loss.

## Prepare Environment File

1. Generate secrets for authentication and database:

   ```bash
   openssl rand -base64 48
   ```

   Use these for `AUTH_JWT_SECRET`, `INVITATION_JWT_SECRET`, and `POSTGRES_PASSWORD` in your `.env` file.

1. Set up Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project or select an existing one
   - Enable Google+ API
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI: `https://example.net/auth/google/callback`
   - Copy Client ID and Secret to `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

1. Edit `.env` and configure:

   ```bash
   # Application Configuration
   ORIGIN=https://example.net # Your production URL

   # Database Configuration
   POSTGRES_USER=dokohub
   POSTGRES_PASSWORD=<generate-secure-password>
   POSTGRES_DB=dokohub
   DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}

   # Authentication Secrets
   AUTH_JWT_SECRET=<generate-random-secrets>
   INVITATION_JWT_SECRET=<generate-random-secrets>

   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   ```
