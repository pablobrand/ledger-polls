## Purpose
This file tells code-assist agents how to be immediately productive in the `ledger-polls` repo (local dev, Docker, and small changes).

**Quick summary:** Full-stack demo: `frontend` (React + Vite + Solana wallet adapters) talks to `backend` (Node.js ESM + Express + Prisma) with `Postgres` in Docker. Client-side encryption (DEK/KEK) is used; Prisma models are under `backend/prisma/schema.prisma`.

**Key Files**
- `backend/src/index.js`: main Express app, auth flow, session handling, and Prisma usage.
- `backend/prisma/schema.prisma`: canonical data models (User, WalletAuth, Persona, EncryptedBlob, UserKeyWrap, etc.).
- `backend/package.json`: backend scripts (`dev`, `start`) and dependencies (Prisma, tweetnacl, bs58).
- `frontend/src/*`: React app and wallet integration (see `App.jsx` and `components/`).
- `frontend/src/utils/crypto.js`: DEK/KEK helpers — encryption is done client-side.
- `docker-compose.yml`: orchestration for Postgres, backend, and frontend for local full-stack runs.

**High-level architecture notes (read before edits)**
- Frontend uses Solana wallet adapters to sign nonces; it derives a KEK client-side, wraps the DEK, and posts encrypted envelopes to the backend.
- Backend issues nonces (`POST /api/auth/login`) and verifies signatures with `tweetnacl` and `bs58` in `backend/src/index.js` (`/api/auth/verify`). Signature input expectations: signature is base64; publicKey is base58.
- Session tokens are random hex stored in `user.sessionToken` and validated by the `authenticate` middleware (look for Authorization Bearer tokens).
- Prisma models assert that PII is stored encrypted client-side; the server stores envelopes and non-secret metadata only.

**Developer workflows & commands (PowerShell examples)**
- Run full stack with Docker (recommended):
  - `docker-compose down`
  - `docker-compose up -d --build`
  - To run migrations from host: `docker-compose exec backend sh -c "cd /app && npx prisma generate && npx prisma migrate deploy"`
- Local development without Docker:
  - Backend: `cd backend; npm install; npx prisma generate; npx prisma migrate dev --name init; npm run dev`
  - Frontend: `cd frontend; npm install; $env:BACKEND_URL='http://localhost:4000'; npm run dev -- --port 3001`
- Build frontend for production: `cd frontend; npm ci; npm run build` (serve `dist/` via nginx or the backend static server).

**Prisma / Database notes**
- Prisma client generation is required after changes to `schema.prisma`: run `npx prisma generate` in `backend`.
- Migrations are under `backend/prisma/migrations` — use `prisma migrate dev` for interactive migration and `prisma migrate deploy` in CI/production.

**Important conventions & gotchas**
- Encryption model: all sensitive user data is encrypted client-side. Avoid adding server-side decryption unless explicitly gated and approved — see `frontend/src/utils/crypto.js` for how envelopes are formed.
- Signature verification: backend expects the stored nonce (`walletAuth.lastNonce`) to be base64; the frontend must sign that nonce and return signature as base64. Mismatched encodings are the most common source of bugs.
- CORS: backend respects `BACKEND_CORS_ORIGIN` env var; default is `*` for development. When running frontend on host, set `BACKEND_URL` for Vite proxy (README explains proxy behavior).
- ESM Node: `backend/package.json` uses `type: "module"` — use `import` syntax and be careful when copying CommonJS snippets.
- Debug logs: dev debug lines exist around signature verification in `backend/src/index.js`. Remove or gate them when hardening production.

**CI / automation notes**
- The README contains a minimal GitHub Actions snippet: ensure `npx prisma generate` runs before `npm run build` in CI.
- Recommended Node version: >= 18 (README/CIs assume Node 20 in examples).

**Small change examples (how to implement safely)**
- Add a new API route that needs DB access:
  - Edit `backend/src/index.js` (or add a modular router), `npm run dev` to test, run `npx prisma generate` if models changed.
  - Write migrations under `backend/prisma` with `prisma migrate dev` locally, commit the generated SQL.
- Change frontend to add new protected API call:
  - Use `fetch('/api/...')` during dev (Vite proxy) or `fetch(process.env.BACKEND_URL + '/api/...')` when running outside the proxy.
  - Ensure Authorization header uses `Bearer <sessionToken>` from user after successful `/api/auth/verify`.

**When in doubt**
- Look at `backend/src/index.js` for auth and session logic and `backend/prisma/schema.prisma` for canonical shapes.
- Re-run `npx prisma.generate` after any schema change.

If anything here is unclear or you want me to expand examples (CI, Docker production image, or make a PowerShell helper script), tell me which area to extend.
