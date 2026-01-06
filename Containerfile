# Build stage
FROM node:24-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build the SvelteKit app
RUN npm run build

# Production image
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built output from builder
COPY --from=builder /app/build ./build

# Default port used by SvelteKit adapter-node output
EXPOSE 4173

CMD ["node", "build"]
