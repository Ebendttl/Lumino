# ⚡ Lumino | Privacy-First Web Analytics Platform

Lumino is an open-source, high-throughput, cookie-free, multi-tenant alternative to Google Analytics. Built as a high-performance TypeScript monorepo, Lumino is designed to capture real-time visitor insights while adhering to strict privacy engineering standards. It completely anonymizes IP addresses at the ingestion boundary, stores no client-side cookies or identifiers, and features an interactive real-time dashboard complete with geographic density heatmaps, conversion funnels, and live user activity streams.

---

## 🏗️ System Architecture

The following diagram illustrates how an analytical pageview flows from a visitor's browser through our asynchronous processing pipeline to the live dashboard.

```mermaid
flowchart TD
    subgraph Client ["Client Browser"]
        A["analytics.js client script"]
    end

    subgraph Gateway ["Express Ingestion API & WS Gateway (:3001)"]
        B["POST /collect Endpoint"]
        C["Rate Limiter (Redis-backed)"]
        D["Site Resolver (Redis Cache / Postgres Fallback)"]
        WS["WebSocket Upgrade Handler"]
    end

    subgraph Broker ["Broker & Queue (:6379)"]
        Q["BullMQ events Queue (Redis)"]
        PUB["Redis Pub/Sub Channel (rt:tenantId)"]
    end

    subgraph Processor ["Worker Process (Background Service)"]
        W["BullMQ Worker Instance"]
        ANON["IP Anonymizer (48-bit IPv6 / 24-bit IPv4)"]
        GEO["Geo-Lookup Resolver (MaxMind MMDB)"]
    end

    subgraph Persistence ["Relational DB (:5432)"]
        DB[(PostgreSQL Database)]
    end

    subgraph UI ["Dashboard Front-end (:3000)"]
        DASH["Next.js Web Application"]
    end

    A -->|"HTTP POST (keepalive: true)"| B
    B -->|"Validate & Rate Limit"| C
    B -->|"Resolve Site Key"| D
    B -->|"202 Accepted (async enqueue)"| Q
    Q -->|"Pulls raw job payload"| W
    W -->|"anonymizeIp()"| ANON
    W -->|"lookupGeo() (MMDB)"| GEO
    W -->|"INSERT Scoped Query"| DB
    W -->|"publish(rt:tenantId)"| PUB
    PUB -.->|"subscribe(rt:tenantId)"| WS
    WS -->|"Stream live updates (JSON)"| DASH
```

### Ingestion Lifecycle Details
1. **Payload Dispatch**: The client-side tracker (`analytics.js`) issues a non-blocking `fetch` request to the `/collect` endpoint using `keepalive: true`. This ensures the request completes successfully even if the user closes or navigates away from the page immediately.
2. **Gatekeeping**: The API Gateway validates the payload using a Zod schema, checks rate limits via Redis (`rate-limiter-flexible`), and looks up the site registration. Site metadata is cached in Redis for 1 hour to prevent hitting PostgreSQL on the hot path.
3. **Queue & Response**: The Gateway enqueues the raw event payload (including headers like client IP and User-Agent) to BullMQ and instantly returns `202 Accepted` to the client.
4. **Asynchronous Execution**: The background Worker pulls jobs from BullMQ. It anonymizes the IP address immediately, resolves geographic data (country/city) via a local MaxMind GeoLite2 database, and commits the records to PostgreSQL.
5. **Real-time Broadcast**: Upon successful database persistence, the Worker publishes a minimal, privacy-cleansed message to Redis Pub/Sub. The WebSocket gateway receives this message and pushes it to all connected dashboard clients active for that tenant.

---

## 📂 Repository Structure

Lumino is organized as a monorepo managed with **pnpm workspaces** and **Turborepo** to isolate concerns and optimize build caching.

| Path | Type | Description | Key Technologies |
| :--- | :--- | :--- | :--- |
| `apps/web` | Application | Next.js dashboard UI, Express API Ingestion Gateway & WebSocket Upgrade Server. | Next.js, Express, WS, Recharts, React Simple Maps, TailwindCSS |
| `apps/worker` | Background Service | BullMQ job consumer. Handles IP cleaning, GeoIP resolution, and PostgreSQL persistence. | Node.js, BullMQ, MaxMind Node SDK, Vitest |
| `packages/db` | Shared Package | Database pool configurations, programmatic migration runner, and schema definitions. | pg, node-pg-migrate |
| `packages/queue` | Shared Package | Shared Redis connection configuration and BullMQ payload interfaces. | BullMQ, ioredis |
| `packages/tracking` | Shared Package | Light-weight `<1KB` client tracking script (`analytics.js`) and esbuild pipeline. | vanilla JS, esbuild |

---

## 🛡️ Privacy Engineering Specification

Lumino was designed to exceed strict compliance guidelines under GDPR, CCPA, and PECR. Its privacy implementation is governed by four engineering pillars:

### 1. Cookie-Free & Storage-Free Mechanics
The client script relies entirely on volatile memory. It does **not** write to or read from:
* `document.cookie`
* `localStorage`
* `sessionStorage`
* `indexedDB`

Because no state is persisted client-side, returning users cannot be linked across sessions, preventing the generation of cross-site tracking profiles.

### 2. Immediate IP Anonymization
Client IP addresses are anonymized before any database write or external API call. The raw IP address is discarded in memory.

* **IPv4 Address Anonymization**: The last octet of the address is zeroed out.
  * *Raw Input*: `192.168.1.123`
  * *Anonymized Output*: `192.168.1.0`
* **IPv6 Address Anonymization**: Only the first 3 groups (48 bits prefix) are retained. The remaining 80 bits are completely zeroed.
  * *Raw Input*: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`
  * *Anonymized Output*: `2001:db8:85a3:0:0:0:0:0`
* **IPv4-Mapped IPv6**: Mapped addresses (e.g. `::ffff:192.168.1.123`) are parsed, stripped of their last octet, and stored as `::ffff:192.168.1.0`.

### 3. Referrer Cleanse
To protect visitor privacy, the tracking script strips the full URL of the referring page down to the host domain name (e.g. `https://github.com/Ebendttl/Lumino/issues/1` -> `github.com`). This avoids accidental capture of sensitive URL parameters (like password reset tokens or search queries).

### 4. Do Not Track (DNT) Respect
The tracking script respects browser privacy preferences. If the browser's `Do Not Track` flag is active, script execution aborts instantly before dispatching any payloads:
```javascript
if (
  navigator.doNotTrack === '1' ||
  window.doNotTrack === '1' ||
  navigator.msDoNotTrack === '1'
) {
  return;
}
```

---

## 🗄️ Database Schema & Data Model

The PostgreSQL database is organized around multi-tenancy. Every site is mapped to a tenant, and every analytics event is strictly associated with a tenant ID.

```mermaid
erDiagram
    TENANTS {
        uuid id PK
        text name
        text email UK
        text password "bcrypt hash"
        timestamptz created_at
    }
    SITES {
        uuid id PK
        uuid tenant_id FK
        text domain
        uuid api_key UK
    }
    EVENTS {
        bigserial id PK
        uuid tenant_id
        uuid site_id FK
        text page
        text referrer
        text device "desktop | mobile | tablet | bot | unknown"
        char2 country
        text city
        timestamptz ts
    }
    FUNNELS {
        uuid id PK
        uuid tenant_id FK
        text name
        text[] steps "ordered paths"
        timestamptz created_at
    }

    TENANTS ||--o{ SITES : owns
    TENANTS ||--o{ FUNNELS : creates
    SITES ||--o{ EVENTS : records
```

### Indexes and Optimizations
To support fast query speeds even with millions of records, the migration script (`packages/db/src/migrations/1718000000000_init.ts`) defines compound indices:
* `idx_events_tenant_id_ts`: Optimized for retrieving dashboard metrics filtered by tenant and sorted chronologically:
  `CREATE INDEX events_tenant_id_ts_idx ON events (tenant_id, ts DESC);`
* `idx_events_site_id_ts`: Tailored for per-website dashboard views:
  `CREATE INDEX events_site_id_ts_idx ON events (site_id, ts DESC);`

---

## ⚙️ Environment Variables

Create a `.env` file at the root of the project. These values are used to coordinate the monorepo configuration:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string. | `postgresql://postgres:password@localhost:5432/lumino?sslmode=disable` |
| `REDIS_URL` | Redis connection URL for BullMQ, Rate Limits, and Pub/Sub. | `redis://localhost:6379` |
| `NEXTAUTH_SECRET` | Used by NextAuth.js to sign JWT tokens. | `a_long_cryptographically_secure_random_string` |
| `AUTH_SECRET` | Authentication backup secret for next-auth. | `same_as_nextauth_secret` |
| `NEXTAUTH_URL` | Canonical URL of the dashboard web application. | `http://localhost:3000` |
| `GATEWAY_PORT` | The port the Ingestion API and WebSocket server listen on. | `3001` |
| `PORT` | Health-check port for the background worker (Render compatibility). | `10000` |
| `WORKER_CONCURRENCY` | Maximum concurrent jobs processed by a single worker thread. | `10` |

---

## 🚀 Local Development Setup

### 1. Prerequisites
* **Node.js** v20.0.0 or higher
* **pnpm** v10.0.0 or higher
* **Docker & Docker Compose** (for localized database instances)

### 2. Infrastructure Setup
Start the local databases in detached mode:
```bash
docker compose up -d db redis
```

### 3. Installation
Install all workspaces dependencies from the root directory:
```bash
pnpm install
```

### 4. Build the Packages
Compile tracking, db, and queue packages:
```bash
pnpm build
```

### 5. Running in Development Mode
Start all services simultaneously in hot-reloading development mode:
```bash
pnpm dev
```
This boots three concurrent tasks:
* **Dashboard App**: served on [http://localhost:3000](http://localhost:3000)
* **Ingestion Gateway**: listening on port `3001`
* **Queue Worker**: running typescript watches

> [!NOTE]
> Database migrations run programmatically when the worker starts up. No manual migration commands are required during initial local runs.

---

## 🧪 Testing & Event Simulation

To test the end-to-end ingestion pipeline locally, follow these steps:

### 1. Seed or Register a Site
Register an account at [http://localhost:3000/signup](http://localhost:3000/signup). Upon login, the application automatically registers a default domain `example.com` and assigns it a site ID.

### 2. Copy the Tracking Snippet
Embed the tracking code on your web pages. The script dynamically extracts its host domain to target the backend ingestion service:
```html
<script 
  defer 
  src="http://localhost:3001/analytics.js" 
  data-site-id="YOUR_SITE_API_KEY_OR_UUID">
</script>
```

### 3. Simulate Traffic via cURL
To simulate events manually, issue a `POST` request to the ingestion endpoint:
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
You should receive a `202 Accepted` response. The worker will process the job, and the event will instantly appear in the **Live Traffic Feed** of your dashboard.

### 4. Running Unit Tests
To validate IP anonymization logic and GeoIP resolution fallbacks, run:
```bash
pnpm --filter worker test
```

---

## ☁️ Production Deployment (Render Platform)

The repository includes a ready-to-deploy `render.yaml` configuration template orchestrating the deployment of the entire stack.

### 1. Services Defined
1. **lumino-dashboard (Web Service)**: Hosts the Next.js frontend on the Free Tier.
2. **lumino-gateway (Web Service)**: Runs the Express ingestion API and manages stateful WebSocket upgrades.
3. **lumino-worker (Web Service)**: Runs the background BullMQ consumer.
   > [!IMPORTANT]
   > Render requires a bound port to declare a web service healthy. The worker instantiates a lightweight HTTP health check server on port `10000` to satisfy Render's health verification checks, preventing service recycles.

### 2. Setup Guide
1. Create a new **Blueprint** on your Render dashboard.
2. Link the Blueprint to your repository.
3. Define the environment variables inside the `lumino-shared-secrets` variable group:
   * Provide your production PostgreSQL database URL (`DATABASE_URL`).
   * Provide your production Redis instance URL (`REDIS_URL`).
4. Apply the Blueprint. Render will automatically configure, build, and deploy the services.

---

## ⚡ Architectural Decisions (ADR)

### Native ESM Module Resolution
The Next.js dashboard app uses native ES modules (`"type": "module"`) to stay compatible with NextAuth v5 (Auth.js) subpath exports.
* *Impact*: Any build/configuration script using CommonJS syntax (such as PostCSS or Tailwind config files) has been explicitly renamed with the `.cjs` extension.

### Pure JS Password Hashing
To prevent compilation failures in restricted cloud environments and static page generators, native C++ compiled binary `bcrypt` is replaced by the pure JavaScript `bcryptjs` package. This avoids compile-time native bindings.

### Build-Time Static Bypass (`force-dynamic`)
Next.js pre-renders pages statically during the build step. Because database connections and secrets are initialized at runtime, this pre-compilation step fails. To prevent build crashes, all dynamic pages and API routes are decorated with `export const dynamic = 'force-dynamic';` to bypass static generation.