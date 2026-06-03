FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration and package manifests
COPY pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/tracking/package.json ./packages/tracking/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies (ignoring scripts)
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts

# Copy source code
COPY packages/db ./packages/db
COPY packages/queue ./packages/queue
COPY apps/worker ./apps/worker

# Build dependencies and the worker application
RUN pnpm --filter @lumino/db build
RUN pnpm --filter @lumino/queue build
RUN pnpm --filter worker build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

# Create directory for MaxMind GeoIP database
RUN mkdir -p /usr/share/GeoIP

ENV NODE_ENV=production

COPY pnpm-workspace.yaml package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/queue ./packages/queue
COPY --from=builder /app/apps/worker ./apps/worker

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
