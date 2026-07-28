# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client (requires DATABASE_URL even though we don't connect)
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
RUN npx prisma generate

# Supabase config is baked into the bundle at build time ($env/static/*),
# so it must be provided as build args (docker-compose.yml passes them).
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL \
    PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev dependencies needed for Prisma CLI and tsx)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy built app from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy necessary config files
COPY svelte.config.js ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY prisma.config.ts ./

# Expose port
EXPOSE 3000

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node build"]

