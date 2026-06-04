# Contributing to Lumino

Thank you for contributing to Lumino! This document outlines guidelines and steps to set up, develop, and submit contributions to this monorepo.

---

## 1. Development Prerequisites

Make sure you have the following installed on your machine:
* **Node.js**: `v20.0.0` or higher
* **pnpm**: `v10.0.0` or higher
* **Docker & Docker Compose**: For local PostgreSQL and Redis services

---

## 2. Workspace Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Ebendttl/Lumino.git
   cd Lumino
   ```

2. **Configure Package Manager Mirror** (Optional, if encountering npm timeouts):
   We use `registry.npmmirror.com` in China or regions with network latency to ensure stable pnpm resolutions.

3. **Install Dependencies**:
   ```bash
   pnpm install
   ```

4. **Spin Up Infrastructure Services**:
   Ensure Docker is running and launch the containerized databases:
   ```bash
   docker start lumino-postgres
   ```
   *(If not initialized, spin up PostgreSQL via `docker-compose.yml` or manual initialization).*

5. **Set Up Environment Variables**:
   Copy `.env` values to `apps/web/.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/lumino?sslmode=disable
   REDIS_URL=redis://localhost:6379
   NEXTAUTH_SECRET=your-nextauth-secret-here
   AUTH_SECRET=your-nextauth-secret-here
   NEXTAUTH_URL=http://localhost:3000
   ```

---

## 3. Development Workflow

### Dev Server
To start all workspaces simultaneously in watch/development mode:
```bash
pnpm dev
```
* The Next.js dashboard is served at `http://localhost:3000`.
* The Ingestion API gateway and WebSocket connection is served at `http://localhost:3001`.

### Workspace Package Commands
* **Run Database Migrations**:
  ```bash
  pnpm --filter @lumino/db migrate
  ```
* **Build all workspaces**:
  ```bash
  pnpm build
  ```
* **Run Tests**:
  ```bash
  pnpm test
  ```

---

## 4. Code & Commit Conventions

### A. ES Modules vs CommonJS
* `apps/web` is configured with `"type": "module"`. Any Node.js utility or loader config (like PostCSS or Tailwind) utilizing CommonJS `module.exports` syntax **must** be renamed to use the `.cjs` extension.
* Use pure JS libraries (e.g. `bcryptjs`) rather than native binary extensions (`bcrypt`) to prevent runtime pre-rendering compiler crashes.

### B. Commit Messages
We follow conventional commit standards. Example format:
* `feat: implement event ingestion endpoint`
* `fix: prevent database connection pool timeout`
* `chore: optimize docker build context`
* `docs: update setup documentation`
