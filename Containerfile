#### BUILDER STAGE ####
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build the SvelteKit app
RUN npm run build

#### RUNNER STAGE ####
FROM node:24-alpine AS runner

# Set working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built output from builder
COPY --from=builder /app/build ./build

# Copy drizzle configuration and migrations
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts

# Copy entrypoint script with execute permissions
COPY entrypoint.sh ./entrypoint.sh

# Default port used by SvelteKit adapter-node output
ENV PORT=5173
EXPOSE 5173

ENTRYPOINT ["/app/entrypoint.sh"]
