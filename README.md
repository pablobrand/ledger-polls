
docker-compose up -d --build
docker-compose exec backend npx prisma migrate deploy
docker-compose build backend
docker-compose up -d backend
docker exec -it $container sh -c "cd /app && npx prisma generate"
docker exec -it $container sh -c "cd /app && npx prisma migrate dev --name apply_changes"
docker-compose build backend
docker-compose up -d backend
docker-compose build backend
docker-compose up -d backend
docker exec -it ledger-polls-backend-1 sh -c "cd /app && npx prisma migrate dev --name init --preview-feature"
docker-compose down
docker volume rm ledger-polls_db_data
docker-compose up -d --build
docker exec -t ledger-polls-db-1 pg_dumpall -c -U postgres > C:\path\to\backup.sql
docker exec -t ledger-polls-db-1 pg_dumpall -c -U postgres > ./backup.sql
docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
# Ledger Polls — Full-stack (React + Vite, Express + Prisma, Postgres)

This repository contains a small full-stack app used to demo wallet-based login (Phantom / Solana).

High level:
- Frontend: React 18 + Vite (dev server / build), Solana wallet adapters (Phantom)
- Backend: Node.js (ESM) + Express + Prisma (Postgres)
- Database: PostgreSQL (Docker)
- Orchestration: Docker & docker-compose for local full-stack runs

## Prerequisites
- Docker Desktop (recommended for full-stack) or Docker Engine + docker-compose
- Node.js (>=18) and npm when running services locally without Docker

## Project layout

```
ledger-polls/
	backend/        # Express API, Prisma schema, migrations
	frontend/       # React + Vite app
	docker-compose.yml
```

---

## Quick start — (Docker) — Recommended

From project root (PowerShell):

```powershell
docker-compose down
docker-compose up -d --build
```

What this does:
- Starts Postgres (port 5432), backend (port 4000), and frontend (port 3000)
- Backend image runs `npx prisma generate` during build so Prisma client is available

Validate services:

```powershell
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
docker-compose logs -f backend
```

Apply migrations (if needed) from host:

```powershell
docker-compose exec backend sh -c "cd /app && npx prisma generate && npx prisma migrate deploy"
```

Interactive migration (creates migration files):

```powershell
docker-compose exec backend sh -c "cd /app && npx prisma migrate dev --name init"
```

Access the app:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

Notes:
- The frontend dev server (Vite) is configured to proxy `/api` to the backend. In Docker this resolves to `http://backend:4000`. When running frontend on host, set `BACKEND_URL=http://localhost:4000` before `npm run dev` so Vite proxies correctly.

---

## Local development (without Docker)

Backend (in one terminal):

```powershell
cd backend
npm install
npx prisma generate
# run migrations if necessary
npx prisma migrate dev --name init
npm run dev
```

Frontend (in another terminal):

```powershell
cd frontend
# tell Vite where to proxy /api to (your local backend)
$env:BACKEND_URL='http://localhost:4000'
npm run dev -- --port 3001

```
```bash
cd frontend
BACKEND_URL='http://localhost:4000' 
npm run dev -- --port 3001
```
Open: http://localhost:3000

---

## Useful quick validation commands

Test backend root:

```powershell
curl http://localhost:4000/
# or PowerShell:
Invoke-RestMethod http://localhost:4000/
```

Test login endpoint:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method POST -ContentType 'application/json' -Body (@{ walletAddress = 'fake_wallet_123' } | ConvertTo-Json)
```

If you use the frontend dev server with the proxy, calling `fetch('/api/auth/login')` from the browser will be proxied to the backend.

---

## Environment variables

- `backend/.env` — contains `DATABASE_URL` and `PORT` (used by Docker). Keep credentials out of source control for production.
- `BACKEND_URL` — used when running the frontend Vite dev server on host so Vite can proxy `/api` to your backend (e.g., `http://localhost:4000`).
- `BACKEND_CORS_ORIGIN` — optional; set in backend to restrict allowed origins (default allows all during development).

---

## Frontend production build suggestion

For production, build the frontend and serve static files instead of running Vite in production. Example steps:

```bash
cd frontend
npm ci
npm run build
# serve the `dist/` with nginx, a CDN, or the backend static server
```

If you want a production Docker image, convert `frontend/Dockerfile` to a multi-stage build: install -> build -> copy build output into a small nginx image.

---

## CI / Batch commands

Below are example batch commands you can use on a CI runner or locally to run the basic pipeline: install, build, Prisma generate, and (optionally) run migrations.

PowerShell (Windows / Azure Pipelines / self-hosted):

```powershell
# from repo root
cd backend
npm ci
npx prisma generate
cd ../frontend
npm ci
npm run build

# optional: build Docker images (if you push images in CI)
docker build -t myorg/ledger-polls-backend:latest ./backend
docker build -t myorg/ledger-polls-frontend:latest ./frontend
```

Bash (Linux/macOS / GitHub Actions):

```bash
# backend
cd backend
npm ci
npx prisma generate
cd ../frontend
npm ci
npm run build

# optional: build/push docker images
docker build -t myorg/ledger-polls-backend:latest ./backend
docker build -t myorg/ledger-polls-frontend:latest ./frontend
```

Minimal GitHub Actions example (paste into `.github/workflows/ci.yml`):

```yaml
name: CI
on: [push, pull_request]
jobs:
	build:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- name: Use Node.js
				uses: actions/setup-node@v4
				with:
					node-version: '20'
			- name: Backend - install & prisma
				working-directory: backend
				run: |
					npm ci
					npx prisma generate
			- name: Frontend - install & build
				working-directory: frontend
				run: |
					npm ci
					npm run build
			# Optional: build docker images and push to registry
			# - name: Build and push images
			#   uses: docker/build-push-action@v5
			#   with:
			#     push: true
			#     tags: ghcr.io/${{ github.repository }}:latest
```

---

## Troubleshooting

- If the frontend can't reach the backend when running locally, ensure `BACKEND_URL` is set for Vite (see "Local development").
- If Postgres is failing, check `docker-compose logs db` and ensure the named volume isn't corrupted. You can remove `db_data` volume to reset DB (destructive).

---

If you'd like, I can: add the `.github/workflows/ci.yml` file for you, convert the frontend Dockerfile to a multi-stage production build, or add a small `Makefile` / PowerShell helper script that runs the common commands.

Happy to continue — tell me which CI or production workflow you'd like me to add next.
