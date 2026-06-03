# Lumino | Privacy-Friendly Web Analytics Platform

Lumino is a lightweight, cookie-free, multi-tenant alternative to Google Analytics. It anonymizes all IP addresses at ingestion time, uses no cookies or client-side storage, and fully isolates data on a per-tenant basis.

## Architecture

```
Client Site (analytics.js)
  │ (fires fire-and-forget payload)
  ▼
API Gateway (Express Server on :3001)
  │
  ├─► Validate Payload (Zod)
  ├─► Rate Limit Check (rate-limiter-flexible + Redis)
  ├─► Site Resolution (Redis Cache-first / Postgres fallback)
  │
  ▼ (pushes raw event)
BullMQ Queue ("events" in Redis)
  │
  ▼ (consumed by)
Worker Process
  │
  ├─► Anonymize IP (strips last IPv4 octet / last 80 IPv6 bits)
  ├─► Geo-Lookup (MaxMind GeoLite2 MMDB / local Mock fallback)
  ├─► Persist to Postgres (scoped strictly to tenant_id)
  │
  ▼ (publishes minimal event)
Redis Pub/Sub Channel ("rt:{tenantId}")
  │
  ▼ (subscribes & pushes live)
WebSocket Server (:3001 upgraded connections)
  │
  ▼ (renders updates)
Next.js Dashboard UI (:3000)
```

## Repository Structure

```
/
├── apps/
│   ├── web/          ← Next.js dashboard, API Gateway & WebSocket Server
│   └── worker/       ← BullMQ worker process (IP anonymization + geo lookup)
├── packages/
│   ├── db/           ← PostgreSQL client pool & migrations (node-pg-migrate)
│   ├── queue/        ← BullMQ shared queue & job definitions
│   └── tracking/     ← analytics.js source & build pipeline (esbuild)
├── docker-compose.yml
└── README.md
```

## Privacy Engineering Rules
1. **Cookie-Free**: The tracking script does not use cookies, `localStorage`, `sessionStorage`, or any form of fingerprinting.
2. **IP Anonymization**: The last octet of IPv4 addresses is zeroed out (e.g. `192.168.1.123` -> `192.168.1.0`), and the last 80 bits of IPv6 are zeroed out (keeping only the first 48 bits) before any database persistence or GeoIP lookups.
3. **No PII Persistence**: No raw IPs, full user-agents, or fingerprint signatures are ever saved to the database.
4. **DNT Header Respect**: If the browser's Do Not Track flag is enabled, the tracking script blocks execution.

---

## Getting Started

### 1. Prerequisites
- **Node.js** v20+
- **pnpm** v10+ (preferred) or npm v10+
- **Docker & Docker Compose** (or local Postgres + Redis instances)

### 2. Environment Setup
Create a `.env` file at the root of the project with the following variables:

```env
# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/lumino?sslmode=disable

# Redis Connection (BullMQ and Rate Limiter)
REDIS_URL=redis://localhost:6379

# NextAuth Configuration
NEXTAUTH_SECRET=a_very_long_random_string_for_signing_tokens
NEXTAUTH_URL=http://localhost:3000

# API Ingestion & WebSocket Gateway Configuration
GATEWAY_PORT=3001
```

### 3. Installation
Install all monorepo dependencies from the root directory:
```bash
pnpm install
```

### 4. Running the Databases
Start Postgres and Redis using Docker Compose:
```bash
docker compose up -d db redis
```

### 5. Running the Application locally

To run the entire development stack (Next.js frontend, Ingestion Express/WebSocket Gateway, and BullMQ worker) run:
```bash
pnpm dev
```

Alternatively, you can boot them individually:

- **Compile and Watch Worker**:
  ```bash
  pnpm --filter worker dev
  ```
- **Run the API Ingestion/WS Gateway**:
  ```bash
  pnpm --filter web gateway
  ```
- **Run the Next.js Frontend Dashboard**:
  ```bash
  pnpm --filter web dev
  ```

### 6. Seeding/Testing
When you sign up at `http://localhost:3000/signup`, the backend automatically seeds a default domain (`example.com`) for you to view in your dashboard. 

To simulate client hits on that domain, you can copy the tracking snippet from the "Tracking Code" button in the dashboard, or fire a test `POST` request directly:
```bash
curl -X POST http://localhost:3001/collect \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "YOUR_SITE_API_KEY_OR_UUID",
    "page": "/pricing",
    "referrer": "github.com",
    "device": "desktop",
    "ts": '$(date +%s%3N)'
  }'
```

## Running Tests
To run unit tests on the worker (IP anonymizer, geo-lookup fallbacks):
```bash
pnpm --filter worker test
```