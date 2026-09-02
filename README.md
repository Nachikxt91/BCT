# TradeDoc OCR Platform

Enterprise multi-user MVP for **LC trade document OCR** (electronics domain) with org tenancy, JWT auth, and hash attestation on blockchain.

> **Architecture & folder guide:** [`ARCHITECTURE_AND_CODEBASE_GUIDE.md`](./ARCHITECTURE_AND_CODEBASE_GUIDE.md) — what we’re building, why, and how every directory connects (layman + technical).

## Structure

```
apps/api          FastAPI — auth, orgs, ingest, OCR, attestation
apps/web          Next.js workbench (login / cases / review)
packages/contracts  Hardhat DocumentAttestation.sol
data/             uploads, ocr pages, local DB (if using SQLite)
```

## Auth & tenancy

- Register creates a **user** + **organization** (you become `owner`)
- Roles: `owner` > `admin` > `reviewer` > `operator`
- Packs are scoped per organization (`X-Org-Id` header)
- Auth pages: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- Settings: change password; sidebar shows user / org / sign out

## Database (free)

**Recommended:** [Neon](https://neon.tech) free Postgres

1. Create a project → copy the connection string  
2. In `apps/api/.env` set:

```
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require
```

**Local fallback:** omit `DATABASE_URL` to use SQLite under `data/ocr_platform.db` (fine for single-machine demos). After schema upgrades, delete that file once so tables recreate.

## Quick start

### 1. API

```powershell
cd apps/api
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# set JWT_SECRET, optional DATABASE_URL / GROQ / GEMINI / SMTP
python -m app.scripts.seed
uvicorn app.main:app --reload --port 8000
```

Seed login (defaults):

- Email: `admin@example.com`
- Password: `Admin123!`

Optional: `GROQ_API_KEY` / `GEMINI_API_KEY`. Without keys the pipeline uses **heuristic + stub OCR**.

Optional SMTP (`SMTP_HOST`, …) for real verify/reset emails. In development, links are **logged to the API console** even without SMTP.

### 2. Web

```powershell
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000 → you will be redirected to **/login**.

### 3. Contracts (optional)

```powershell
cd packages/contracts
npm install
npx hardhat test
npx hardhat node
# other terminal:
npx hardhat run scripts/deploy.js --network localhost
```

## Pipeline

Upload → SHA-256 → PDF/pages → classic OCR → (low conf → Gemini/Groq vision) → classify → extract JSON → review → approve → attest (mock or on-chain)

## Scope

- Automating **OCR / extraction** of paper packs with multi-user org isolation
- **Not** SWIFT payments or UCP legal examination replacement
