# Lumino Project Memory & Architecture Guide

This document serves as the historical record, architectural map, and engineering memory for the **Lumino** privacy-friendly web analytics platform. It captures our current state, past challenges, resolution steps, and guidelines for future modifications.

---

## 1. Project Overview & Architecture

Lumino is structured as a high-throughput, multi-tenant, cookie-free web analytics platform organized as a TypeScript monorepo using **pnpm workspaces** and **Turborepo**.

### The Data Ingestion Pipeline
```
Client Site (analytics.js)
   │
   ▼ [HTTP POST /collect]
API Ingestion Gateway (Express Server - apps/web/src/gateway.ts)
   │
   ▼ [Enqueue Event Job]
Redis Queue (BullMQ - packages/queue)
   │
   ▼ [Process Job]
Worker Process (apps/worker)
   ├── IP Anonymization (anonymize IP at ingestion)
   ├── Geo-lookup (mock / GeoLite2 MMDB City lookup)
   ▼
PostgreSQL Store (packages/db - per-tenant events table)
```

### Monorepo Workspaces Map
* **`apps/web`**: Next.js 14 frontend dashboard & real-time analytics UI. It also hosts the standalone Express Ingestion API & WebSocket upgrade gateway (`src/gateway.ts`).
* **`apps/worker`**: Standalone Node process that consumes analytics jobs from Redis, anonymizes client IPs, performs geo-resolution, and persists events to PostgreSQL.
* **`packages/db`**: Database connector, pooled clients, schema definitions, and migration scripts via `node-pg-migrate`.
* **`packages/queue`**: Shared BullMQ connection wrapper and queue worker payload types.
* **`packages/tracking`**: Light-weight, cookie-free `<1KB` client tracking script (`analytics.js`) compiling via `esbuild`.

---

## 2. Key Technical Stack Decisions

### A. ESM vs CommonJS Module Resolution
* **Decision**: The Next.js dashboard app (`apps/web`) is configured as a native ES Module package using `"type": "module"`.
* **Reasoning**: NextAuth v5 (Auth.js) uses modern subpath exports (such as `next-auth/jwt`) that require an ESM resolver. Running the Express gateway on Next.js assets via `tsx` would fail with resolution errors under CommonJS.
* **Impact**: All configuration files that use CommonJS `module.exports` syntax (like `tailwind.config.js` and `postcss.config.js`) must be explicitly named with the `.cjs` extension.

### B. Pure JS Password Hashing
* **Decision**: Replaced native C++ binary `bcrypt` with the pure JavaScript implementation `bcryptjs`.
* **Reasoning**: Native binary dependencies frequently trigger compiler issues in cloud functions, Edge environments, and Next.js static page generators during build runs. `bcryptjs` avoids compile-time bindings.

### C. Build-Time Static Bypass (`force-dynamic`)
* **Decision**: Outlined all API routes under `/api` and the dashboard layout as `force-dynamic`.
* **Reasoning**: Next.js automatically attempts static pre-rendering at build time. Because database pooling and NextAuth config are initialized dynamically (and the production database is not connected during CI/CD compilation), static page generation fails. Marking pages dynamic instructs the compiler to skip pre-rendering.

---

## 3. Local Development Setup

### Docker Infrastructure
Start local PostgreSQL database:
```bash
docker start lumino-postgres
```

### Environment Variables
Configure `apps/web/.env` with the following:
```env
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/lumino?sslmode=disable
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=3c829e73b22cfc1b48d61324838b97d0
AUTH_SECRET=3c829e73b22cfc1b48d61324838b97d0
NEXTAUTH_URL=http://localhost:3000
```

### Start Development Server
```bash
npm run dev
```
* **Port 3000**: Next.js Dashboard & Authentication UI.
* **Port 3001**: API Ingestion Gateway & WebSocket realtime connection.

---

## 4. Maintenance & Safety Policies

### Docker Containerization
* Always build the worker container using the optimized, cached `apps/worker/Dockerfile`.
* The `.dockerignore` file prevents copying local `node_modules/` or build output folders into the container context, keeping image sizes small.

### Git Hygiene
* Ensure `.gitignore` is maintained to prevent committing log outputs (`*.log`), dependency maps (`node_modules/`), and local environment configurations (`.env`, `.env.local`).
