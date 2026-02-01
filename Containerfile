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

# Default port used by SvelteKit adapter-node output
EXPOSE 5173

CMD ["node", "build"]
