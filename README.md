# Ledger Polls

Ledger Polls is a full-stack demo app for Solana wallet login and client-side encrypted persona storage.

Current MVP scope:
- Wallet login with Phantom-compatible Solana wallets
- Backend-issued nonce challenge and signature verification
- Bearer-token session handling
- Client-side persona encryption before upload
- Encrypted persona envelope storage in Postgres

This repo is not feature-complete yet. The database schema already includes models for surveys, assignments, answers, payouts, and audit logging, but the current app mainly covers auth and persona onboarding.

## Stack

- Frontend: React 18 + Vite + Solana wallet adapters
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Local orchestration: Docker Compose

## What is implemented today

### Backend
- `POST /api/auth/login` issues a nonce for a wallet address with explicit auth mode (`signup` or `signin`)
- `POST /api/auth/verify` verifies the wallet signature and returns a session token
- `GET /api/user/me` returns the authenticated user summary plus persona/consent status
- `GET /api/user/persona` returns the latest encrypted persona envelope and wrapped DEK metadata
- `POST /api/user/persona` stores an encrypted persona envelope and wrapped DEK
- `GET /api/audience/summary` returns audience totals/distributions (authenticated)
- `GET /api/public/audience/summary` returns audience totals/distributions (public aggregate fallback)

### Frontend
- Wallet connect and sign-in flow
- Simple welcome screen after login
- Persona form that encrypts data client-side before upload

## Project layout

```text
ledger-polls/
├─ backend/                 # Express API, Prisma schema, migrations
├─ frontend/                # React + Vite app
├─ docker-compose.yml
├─ docker-compose.override.yml
└─ README.md
```

## Prerequisites

- Docker Desktop or Docker Engine with Compose
- Node.js 18+ and npm for local development without Docker
- A Solana wallet that supports message signing

## Quick start with Docker

From the repo root:

```powershell
docker compose down
docker compose up -d --build
```

```bash
docker compose down
docker compose up -d --build
```

This starts:
- Postgres on `5432`
- Backend API on `4000`
- Frontend Vite app on `3000`

Open the app at `http://localhost:3000`.

### Useful Docker checks

```powershell
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
docker compose logs -f backend
```

```bash
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
docker compose logs -f backend
```

### Prisma commands from the host

Generate Prisma client and apply existing migrations:

```powershell
docker compose exec backend sh -c "cd /app && npx prisma generate && npx prisma migrate deploy"
```

```bash
docker compose exec backend sh -c "cd /app && npx prisma generate && npx prisma migrate deploy"
```

Create a new local migration:

```powershell
docker compose exec backend sh -c "cd /app && npx prisma migrate dev --name init"
```

```bash
docker compose exec backend sh -c "cd /app && npx prisma migrate dev --name init"
```

### After migrations: run and verify Docker services

Start or restart all services:

```powershell
docker compose up -d --build
```

```bash
docker compose up -d --build
```

Check service status (look for `Up` on `db`, `backend`, and `frontend`):

```powershell
docker compose ps
```

```bash
docker compose ps
```

Check running ports:

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

If frontend is not visible, check frontend logs:

```powershell
docker compose logs --tail 100 frontend
```

```bash
docker compose logs --tail 100 frontend
```

## Seed test personas

The repo includes a Prisma seed script that creates 20 synthetic persona profiles for testing.

What the seed does:
- Removes prior synthetic users with wallet prefix `seed_wallet_` (idempotent reruns)
- Creates 20 synthetic users
- Creates persona records in both:
  - `encrypted_blobs` (`kind='persona'`) for current audience analytics path
  - `personas` table for direct SQL inspection

Run seed in Docker:

```powershell
docker compose exec backend npm run seed
```

```bash
docker compose exec backend npm run seed
```

Quick checks:

```powershell
docker compose exec db psql -U postgres -d postgres -c "select count(*) as personas_count from personas;"
docker compose exec db psql -U postgres -d postgres -c "select count(*) as blobs_count from encrypted_blobs where kind='persona';"
```

```bash
docker compose exec db psql -U postgres -d postgres -c "select count(*) as personas_count from personas;"
docker compose exec db psql -U postgres -d postgres -c "select count(*) as blobs_count from encrypted_blobs where kind='persona';"
```

Quick health checks:

```powershell
Invoke-RestMethod http://localhost:4000/
```

```bash
curl http://localhost:4000/
```

Open app URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## Local development without Docker

### Backend

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

The backend runs on `http://localhost:4000`.

### Frontend

Default Vite port is `3000`.

```powershell
cd frontend
$env:BACKEND_URL='http://localhost:4000'
npm install
npm run dev
```

```bash
cd frontend
export BACKEND_URL='http://localhost:4000'
npm install
npm run dev
```

If port `3000` is already in use, run Vite on another port:

```powershell
npm run dev -- --port 3001
```

```bash
npm run dev -- --port 3001
```

If you do that, open `http://localhost:3001`.

## How the current auth flow works

1. The frontend requests a nonce from `POST /api/auth/login` with `authMode` set to `signup` or `signin`
2. The wallet signs the nonce
3. The frontend sends the signature and exact nonce to `POST /api/auth/verify`
4. The backend returns a `sessionToken`
5. The frontend uses `Authorization: Bearer <sessionToken>` for protected requests

Notes:
- `signin` requires the wallet to already be registered
- nonce verification is bound to the exact challenge to prevent mismatch/race issues

## How persona storage works today

- Persona data is encrypted in the browser
- A DEK is generated client-side
- A KEK is derived from a wallet signature
- The DEK is wrapped client-side
- The backend stores:
  - the encrypted persona envelope
  - the wrapped DEK
  - non-secret metadata

For the current MVP, encrypted persona data is stored through `EncryptedBlob` and used by audience analytics. The `Persona` model is also populated by seed data for SQL-level validation and future migration alignment.

## Audience analytics endpoints

The Welcome page analytics use persona profile metadata snapshots and supports filters:
- `educationLevel`
- `minAge` / `maxAge`
- `country`, `state`, `city`
- `sex`

Authenticated endpoint:
- `GET /api/audience/summary`

Public aggregate fallback endpoint:
- `GET /api/public/audience/summary`

Example query:

```bash
curl "http://localhost:4000/api/public/audience/summary?educationLevel=Bachelor%27s%20degree&minAge=30&maxAge=45&country=United%20States"
```

## Environment variables

### Backend
- `DATABASE_URL`: Postgres connection string
- `PORT`: backend port, defaults to `4000`
- `BACKEND_CORS_ORIGIN`: optional allowed origin for CORS; defaults to `*` in development
- `BACKEND_URL`: in Docker/frontend context should resolve to `http://backend:4000`

### Frontend
- `BACKEND_URL`: target used by the Vite dev proxy when running the frontend outside Docker, usually `http://localhost:4000`

## Validation commands

Check the backend root:

```powershell
Invoke-RestMethod http://localhost:4000/
```

```bash
curl http://localhost:4000/
```

Request a nonce:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method POST -ContentType 'application/json' -Body (@{ walletAddress = 'fake_wallet_123' } | ConvertTo-Json)
```

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"fake_wallet_123"}'
```

## Current limitations

- Session tokens are currently stored client-side for MVP simplicity
- Persona DEK persistence is demo-grade and should be hardened later
- Survey, assignment, answer, payout, and admin flows are not finished yet
- The frontend Docker image currently runs the Vite dev server, not a production static build

## Prisma config note

This project uses `backend/prisma.config.ts` for Prisma configuration (including seed command), replacing deprecated `package.json#prisma` configuration.

## Production note

The current Docker setup is optimized for local development. For production, the frontend should be built to static files and served from a proper web server or CDN instead of running the Vite dev server.

Example build:

```powershell
cd frontend
npm ci
npm run build
```

```bash
cd frontend
npm ci
npm run build
```

## Recommended next milestones

1. Stabilize wallet signing and remove temporary debug-only behavior
2. Align persona encryption and retrieval flow end-to-end
3. Improve authenticated frontend routing and onboarding state
4. Add consent handling
5. Build the first thin survey slice

## Troubleshooting

- If the frontend cannot reach the backend in local development, verify `BACKEND_URL` is set correctly before starting Vite.
- If Welcome analytics are empty, check the audience API directly:

```bash
curl http://localhost:4000/api/public/audience/summary
```

- If analytics return data but UI does not update, restart services:

```bash
docker compose restart backend frontend
```

- If wallet injection is inconsistent, try a clean browser profile and confirm the wallet extension is enabled for local sites.
- If the database gets into a bad local state, check the `db` container logs and reset the named volume only if you are fine losing local data.


## Day to day commands
Today:

docker compose down
Tomorrow:

docker compose up -d
docker compose ps
If you changed Dockerfiles or dependencies and want a fresh image rebuild tomorrow, use:

docker compose up -d --build
Your database data should still be there because it is stored in the named volume. Only use docker compose down -v if you want to delete DB data.