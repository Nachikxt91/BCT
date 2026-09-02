# TradeDoc OCR Platform  
## Architecture & Codebase Guide

**Audience:** developers, project mentors, and non-technical stakeholders  
**Repo root:** `BCT/`  
**Last aligned to codebase:** September 2026  

This document explains:

1. **What we are building and why**  
2. **How the system works end-to-end** (simple + technical)  
3. **What every major directory/file does**  
4. **How pieces connect**  
5. **Why the architecture looks this way** (design decisions)

---

## Table of contents

1. [What we are building](#1-what-we-are-building)  
2. [Why this problem matters](#2-why-this-problem-matters)  
3. [What we are *not* building](#3-what-we-are-not-building)  
4. [System in one picture](#4-system-in-one-picture)  
5. [End-to-end journey of one document pack](#5-end-to-end-journey-of-one-document-pack)  
6. [Repository map](#6-repository-map)  
7. [Directory-by-directory deep dive](#7-directory-by-directory-deep-dive)  
8. [How components talk to each other](#8-how-components-talk-to-each-other)  
9. [Architecture decisions (why we built it this way)](#9-architecture-decisions-why-we-built-it-this-way)  
10. [Data that lives where](#10-data-that-lives-where)  
11. [Security & trust model](#11-security--trust-model)  
12. [How to think about the blockchain piece](#12-how-to-think-about-the-blockchain-piece)  
13. [Related docs in this repo](#13-related-docs-in-this-repo)

---

## 1. What we are building

### In plain English

We are building a **workbench for trade documents**.

Imagine a bank or exporter receives a thick packet of papers for a Letter of Credit (LC) trade — invoice, packing list, bill of lading, certificates, etc. Today, people open those PDFs/scans and **manually read and type** important fields.

Our product:

1. Lets a user **upload** that packet  
2. **Reads the text** from the pages (OCR)  
3. **Figures out what each page is** (invoice vs BL vs certificate…)  
4. **Pulls out key fields** into a structured form (invoice number, amount, dates…)  
5. Lets a human **review / approve**  
6. Optionally writes a **fingerprint (hash)** of the document + extraction result onto a **blockchain**, so later anyone can prove “this exact pack was verified at this time” without publishing the private documents themselves  

**First industry focus:** electronics trade LC packs (BIS / WPC-style compliance docs are common and relatively structured).

### Technical product name / scope

**Trade Document Intelligence + Integrity Platform (MVP)**

| Capability | Status in MVP |
|------------|---------------|
| Upload PDF/image packs | Yes |
| Classic OCR + AI-assisted extraction | Yes (with offline stubs if no API keys) |
| Human review UI | Yes |
| Org/user auth | Yes |
| On-chain hash attestation | Yes (or mock if chain not configured) |
| Full UCP 600 legal examination engine | Not yet |
| SWIFT payment / LC issuance | Out of scope |

---

## 2. Why this problem matters

### Business pain (layman)

- Trade documents are still heavily **paper or PDF**.  
- Banks digitize **routing** (upload → folder → maker-checker queue) but often still rely on humans for **content checking**.  
- Mistakes and discrepancies cause **delays, rework, and cost**.  
- Industry estimates still show **very high first-presentation discrepancy rates** for documentary credits (commonly cited in ICC-related coverage in the ~65–80% range — treat as industry estimate, not our measured bank KPI).

### Why automation helps (but carefully)

OCR + AI can:

- Speed up reading and data entry  
- Flag low-confidence fields for humans  
- Create an audit trail  

AI **should not** silently replace bank liability under UCP 600. That is why we keep **human-in-the-loop approval**.

### Why blockchain is in the project

This is a **blockchain course / BCT project** as well as an OCR product.

We use blockchain for **integrity and audit**, not for paying money:

- Store `SHA-256(document)` and `SHA-256(extraction result)`  
- Never store invoice PDFs or personal data on-chain  
- Later, a third party can recompute the hash of a file and check it matches the on-chain record  

---

## 3. What we are *not* building

To keep scope honest:

| Not in MVP | Reason |
|------------|--------|
| Replacing Finacle / core banking | Banks already own that; we sit beside it |
| Issuing LCs / sending SWIFT MT700 | Different product surface |
| Automatic payment release / escrow oracles | High regulatory + operational risk |
| Claiming “AI approved = UCP compliant” | Legal examination stays human-owned |
| Putting full documents on blockchain | Privacy, cost, GDPR/bank secrecy |

---

## 4. System in one picture

```
 ┌──────────────────────────────┐
 │  Operator browser            │
 │  apps/web  (Next.js UI)      │
 │  login → upload → review     │
 └──────────────┬───────────────┘
                │ HTTPS JSON / file upload
                ▼
 ┌──────────────────────────────┐
 │  Backend API                 │
 │  apps/api  (FastAPI)         │
 │  auth · orgs · packs · OCR   │
 │  LLM router · attestation    │
 └──────┬───────────┬───────────┘
        │           │
        │           ▼
        │    ┌──────────────────┐
        │    │ Local chain      │
        │    │ packages/        │
        │    │ contracts        │
        │    │ (Hardhat +       │
        │    │  Solidity)       │
        │    └──────────────────┘
        ▼
 ┌──────────────────────────────┐
 │  data/                       │
 │  uploads/  ocr/  SQLite DB   │
 └──────────────────────────────┘
```

**Layman version:**  
The website is the front desk. The API is the back office that does the reading. The database/files are the filing cabinet. The blockchain is the stamped notary receipt that only records fingerprints.

---

## 5. End-to-end journey of one document pack

### Simple story

1. User logs in.  
2. Uploads `invoice.pdf` (or a PNG scan).  
3. System saves the file and computes a fingerprint (`SHA-256`).  
4. System splits pages / prepares images.  
5. OCR reads text from each page.  
6. If reading is weak, a vision model may retry that page.  
7. System classifies the page type and extracts fields.  
8. UI shows fields; low-confidence ones are highlighted.  
9. Reviewer clicks **Approve**.  
10. Reviewer clicks **Attest** → fingerprint goes to blockchain (or mock tx in demo mode).

### Technical pipeline

```
Upload
  → store file under data/uploads/{pack_id}/
  → sha256(file) stored on TradePack
  → status: uploaded

Process
  → preprocess (PDF→images or copy image)
  → per page: classic OCR (Paddle → Tesseract → stub)
  → if confidence < threshold: Gemini vision, else Groq vision
  → classify doc type (Groq / heuristic)
  → extract JSON fields (Groq / Gemini / heuristic)
  → result_hash = sha256(canonical extracted fields JSON)
  → status: needs_review

Approve
  → status: approved

Attest
  → DocumentAttestation.attest(packId, docHash, resultHash)
     OR mock 0xmock… if chain env not set
  → status: attested
```

---

## 6. Repository map

```
BCT/
├── apps/
│   ├── api/                          # Backend (Python / FastAPI)
│   └── web/                          # Frontend (Next.js)
├── packages/
│   └── contracts/                    # Blockchain (Hardhat + Solidity)
├── data/                             # Runtime files & SQLite (not source)
├── _research_extracts/               # Text extracted from research PDFs
├── README.md                         # How to run
├── ARCHITECTURE_AND_CODEBASE_GUIDE.md  # This file
├── OCR_Development_Plan_Enterprise.md  # Build plan / stack / phases
└── LC_Document_Processing_Research_and_Development_Plan.md
                                      # Domain research (LC workflow evidence)
```

---

## 7. Directory-by-directory deep dive

---

### 7.1 `apps/` — runnable applications

**Layman:** Everything a user can “start” lives here: the website and the server.  
**Technical:** Standard monorepo pattern (`apps/*` for deployable services, `packages/*` for shared libraries/contracts).  
**Why:** Keeps frontend, backend, and chain tooling independently versioned and runnable.

---

### 7.2 `apps/api/` — the backend brain

**Layman:** This is the office that actually reads documents, talks to AI, and talks to the blockchain. The browser never does OCR itself.  
**Technical:** FastAPI service on port `8000`. Owns business logic, persistence, LLM calls, and chain writes.  
**Why:** OCR/LLM work is heavy and secret-key-bearing; it must stay server-side.

#### Important subfolders

| Path | Role (simple) | Role (technical) | Why |
|------|---------------|------------------|-----|
| `app/main.py` | Turns the server on | FastAPI app factory, CORS, router mount, DB init lifespan | Single entrypoint |
| `app/api/` | The “doors” the UI knocks on | HTTP route modules: `auth`, `orgs`, `packs`, `attestation`, `health` | Separation of HTTP from business logic |
| `app/core/` | House rules | `config.py` (env), `db.py` (SQLAlchemy), `security.py`, `deps.py`, `email.py` | Cross-cutting concerns in one place |
| `app/models/` | Database tables | SQLAlchemy entities: users/orgs/packs/pages/fields | Typed persistence model |
| `app/services/` | The actual work | `pipeline.py`, `ocr.py`, `llm_router.py`, `attestation.py` | Reusable domain services, testable without HTTP |
| `app/workers/` | Future job runners | Placeholder for durable async workers | Today BackgroundTasks; later Redis/RQ |
| `app/scripts/` | Setup helpers | e.g. seed data | Dev/demo bootstrap |
| `tests/` | Safety checks | Pytest for heuristics/hashing | Catch regressions without UI |
| `.env` / `.env.example` | Secret settings | API keys, JWT secret, chain RPC, contract address | 12-factor config |
| `.venv/` | Isolated Python | Virtualenv with pinned deps from `requirements.txt` | Reproducible installs |
| `requirements.txt` | Ingredient list | Python dependencies | Declarative backend stack |

#### `app/api/` endpoints (conceptual)

| Module | What it does |
|--------|----------------|
| `health.py` | “Is the server alive?” |
| `auth.py` | Register / login / refresh tokens |
| `orgs.py` | Multi-tenant organizations & membership |
| `packs.py` | Upload packs, run OCR, approve, attest, list/detail |
| `attestation.py` | Chain config status |
| `schemas.py` / `auth_schemas.py` | Request/response shapes (Pydantic) |

#### `app/services/` internals

| Service | Simple | Technical |
|---------|--------|-----------|
| `pipeline.py` | Full “process this pack” recipe | Orchestrates preprocess → OCR → classify → extract → hash → status machine |
| `ocr.py` | Read text from page images | PaddleOCR → Tesseract → deterministic stub |
| `llm_router.py` | Ask AI smartly with backups | Groq primary text; Gemini vision primary; retries/backoff; heuristics offline |
| `attestation.py` | Notarize fingerprints | web3.py call to Solidity, or mock tx |

---

### 7.3 `apps/web/` — the operator workbench

**Layman:** The screens people click: login, upload, case list, review fields, audit.  
**Technical:** Next.js App Router frontend; talks to API via `fetch` with JWT. UI styled in a shadcn-like component system (Radix + Tailwind).  
**Why:** Enterprise ops need a clear review UI with PDF/text + fields side-by-side; browsers are the right delivery surface.

#### Important subfolders

| Path | Role (simple) | Role (technical) | Why |
|------|---------------|------------------|-----|
| `src/app/` | Pages/routes | Next.js routes: `/`, `/login`, `/register`, `/upload`, `/cases/[id]`, `/audit`, `/settings` | URL = screen |
| `src/components/` | Reusable UI blocks | App shell, auth guard, badges, cards, buttons | Consistency + speed |
| `src/lib/api.js` | Phone line to backend | Authenticated API client, token refresh | Centralize HTTP + auth headers |
| `src/lib/auth.js` | Remember who is logged in | Token/session helpers in browser storage | Stateless API + client session |
| `src/lib/utils.js` | Tiny helpers | `cn()` class merging for Tailwind | shadcn convention |
| `.env.local` | Where is the API? | `NEXT_PUBLIC_API_URL` | Env-specific backend URL |
| `package.json` | JS dependencies | Next, React, Radix, etc. | Frontend toolchain |

#### Page intents

| Route | Purpose |
|-------|---------|
| `/login`, `/register` | Access control |
| `/` (cases) | Queue of document packs |
| `/upload` | Ingest new pack |
| `/cases/[id]` | Review OCR text + fields; approve; attest |
| `/audit` | See attestation receipts |
| `/settings` | Show model/chain configuration guidance |

---

### 7.4 `packages/contracts/` — blockchain integrity layer

**Layman:** A tiny digital notary. It does **not** store your invoice. It stores a unique fingerprint so you can later prove the file wasn’t changed.  
**Technical:** Hardhat project with Solidity `DocumentAttestation`, deploy script, and tests. Local node typically on `http://127.0.0.1:8545`.  
**Why:** Meets BCT project requirement and provides immutable audit evidence without putting sensitive trade docs on a public ledger.

#### Important paths

| Path | Role |
|------|------|
| `contracts/DocumentAttestation.sol` | Smart contract: `attest(packId, docHash, resultHash)` |
| `scripts/deploy.js` | Deploys contract; prints address |
| `test/` | Contract unit tests |
| `hardhat.config.js` | Compiler + network config (`localhost` → `:8545`) |
| `artifacts/` | Compiled ABI/bytecode (generated) |
| `cache/` | Hardhat build cache (generated) |
| `node_modules/` | JS deps for Hardhat (generated) |

#### How deploy works (common confusion)

1. Terminal A: `npx hardhat node` → starts local chain on **8545**  
2. Terminal B: `npx hardhat run scripts/deploy.js --network localhost`  
3. Copy address into `apps/api/.env` as `ATTESTATION_CONTRACT_ADDRESS`  
4. Set `CHAIN_RPC_URL=http://127.0.0.1:8545` and a Hardhat account private key  

If step 1 is skipped → error `HH108 / ECONNREFUSED 8545`.

If chain env vars are empty → API uses **mock attestation** (`0xmock…`) so demos still work.

---

### 7.5 `data/` — runtime storage

**Layman:** The filing cabinet created while the app runs.  
**Technical:** Local filesystem + SQLite. Not committed as meaningful source (uploads are ephemeral demo data).  
**Why:** Zero-ops local MVP (no mandatory S3/Postgres). Easy for college demos.

| Path | Contents |
|------|----------|
| `data/uploads/{pack_id}/` | Original uploaded files |
| `data/ocr/{pack_id}/` | Rasterized page images (`page_001.png` …) |
| `data/ocr_platform.db` | SQLite DB: users, orgs, packs, pages, fields, statuses |

**Architecture note:** In production this would become encrypted object storage (S3) + managed Postgres. Same API contracts; different adapters.

---

### 7.6 `_research_extracts/` — research corpus

**Layman:** Notes/text pulled from your synopsis and workflow PDFs so research didn’t depend on opening every PDF every time.  
**Technical:** Plain-text extracts used while writing the research/plan docs.  
**Why:** Evidence trail for domain decisions (electronics vs oil vs engineering; bank EBL flows).

---

### 7.7 Root markdown documents

| File | Purpose |
|------|---------|
| `README.md` | Practical runbook |
| `ARCHITECTURE_AND_CODEBASE_GUIDE.md` | This architecture explanation |
| `OCR_Development_Plan_Enterprise.md` | Phased build plan, Groq/Gemini, fallbacks, stack |
| `LC_Document_Processing_Research_and_Development_Plan.md` | Evidence-based LC workflow research; claim validation |

---

## 8. How components talk to each other

### 8.1 Web ↔ API

```
Browser  --JSON/JWT-->  FastAPI routes  -->  services  -->  SQLite + files
```

- UI never holds Groq/Gemini keys.  
- UI sends `Authorization: Bearer <access_token>`.  
- On 401, client tries refresh token, then re-login if needed.

### 8.2 API ↔ OCR / LLM providers

```
pipeline
  ├─ ocr.py (local engines)
  └─ llm_router.py
       ├─ Groq (classify / extract / secondary vision)
       ├─ Gemini (primary vision fallback)
       └─ heuristics (no keys / provider down)
```

### 8.3 API ↔ Blockchain

```
packs.attest
  → attestation.attest_hashes
      → web3.Contract.attest(...)   if configured
      → mock tx                     otherwise
  → save tx hash on TradePack
```

### 8.4 Sequence (approve + attest)

```
User clicks Attest in apps/web
   → POST /api/v1/packs/{id}/attest
   → API checks pack approved + result_hash exists
   → hashes sent to DocumentAttestation (or mock)
   → UI shows tx on case + audit page
```

---

## 9. Architecture decisions (why we built it this way)

| Decision | Choice | Why (architecture) |
|----------|--------|--------------------|
| Monorepo | `apps/*` + `packages/*` | One repo for product + chain; independent runtimes |
| Backend language | Python / FastAPI | Best ecosystem for OCR/ML; fast to iterate |
| Frontend | Next.js + shadcn-style UI | Professional ops UX; component speed |
| OCR strategy | Classic OCR first, VLM fallback | VLMs alone are flaky/expensive on stamped scans |
| LLM strategy | Groq + Gemini hybrid | Speed (Groq) + strong vision (Gemini) + offline heuristics |
| DB for MVP | SQLite | No Docker required for first demos |
| Chain role | Hash attestation only | Satisfies BCT goal without unsafe “AI pays money” claims |
| Mock attestation | Allowed when RPC unset | Demo resilience; chain is optional locally |
| Human approval gate | Required before meaningful trust | Aligns with bank maker-checker / UCP reality |
| Domain first | Electronics | Bounded document set; clearer MVP success criteria |
| Secrets in `.env` | Server-only | Prevent browser key leakage |

### Design principles we intentionally follow

1. **Separate concerns:** UI ≠ OCR ≠ chain.  
2. **Fail soft:** provider outage → heuristics/stub, don’t crash the whole product.  
3. **Evidence over magic:** store model id, confidence, hashes, statuses.  
4. **Privacy-first chain:** hashes yes, documents no.  
5. **Scope discipline:** automate paper *reading*, not the entire trade finance rail.

---

## 10. Data that lives where

| Data | Where | On blockchain? |
|------|-------|----------------|
| PDF/PNG bytes | `data/uploads` | **No** |
| Page images | `data/ocr` | **No** |
| OCR text / fields | SQLite | **No** |
| User passwords | SQLite (hashed) | **No** |
| Document SHA-256 | SQLite + optionally chain | **Yes (hash only)** |
| Extraction result SHA-256 | SQLite + optionally chain | **Yes (hash only)** |
| Attestation tx id | SQLite | Tx lives on chain; id mirrored in DB |

---

## 11. Security & trust model

### What we trust today (MVP)

- Server process + `.env` secrets  
- Authenticated org members for pack operations  
- Human reviewer before “approved/attested” is meaningful  

### What we do **not** claim yet

- Full bank-grade IAM / SSO  
- Hardware security module key custody  
- Formal model risk management for AI decisions  
- Legal equivalence to UCP document examination  

### Threats we consciously design against

| Threat | Mitigation in architecture |
|--------|----------------------------|
| API keys in frontend | Keys only in `apps/api` |
| Silent AI errors | Confidence flags + human review |
| Document leakage on-chain | Hash-only attestation |
| Lost in-flight jobs | Known gap: move to durable queue later |
| Unauthenticated access | Auth routes + guarded UI |

---

## 12. How to think about the blockchain piece

### Analogy

You do **not** put the house deeds on a public billboard.  
You put a **notary stamp** that says “document with fingerprint X was recorded at time T.”

### In this project

- **Hardhat** = local fake blockchain lab  
- **DocumentAttestation.sol** = the notary stamp machine  
- **API attestation service** = clerk who submits the stamp after approval  

If Hardhat node isn’t running, deploy fails (`ECONNREFUSED :8545`). That does **not** mean the OCR product is broken — only that real on-chain mode isn’t available. Mock mode still demonstrates the product flow.

---

## 13. Related docs in this repo

| If you want… | Read |
|--------------|------|
| How to run locally | `README.md` |
| Phased engineering plan / Groq-Gemini / fallbacks | `OCR_Development_Plan_Enterprise.md` |
| LC domain research & claim validation | `LC_Document_Processing_Research_and_Development_Plan.md` |
| Folder + architecture meaning | **This file** |

---

## Appendix A — Mental model cheat sheet

| Folder | One-line meaning |
|--------|------------------|
| `apps/web` | What humans see |
| `apps/api` | What the system does |
| `packages/contracts` | How we notarize hashes |
| `data` | Where files/DB live while running |
| `_research_extracts` | Source notes from domain research |
| Root `*.md` | Plans, research, runbooks |

---

## Appendix B — Success definition for this MVP

We succeed when:

1. A user can upload an electronics-style trade document pack.  
2. The system produces readable OCR text + structured fields.  
3. A reviewer can approve the pack.  
4. The system can attach an integrity receipt (mock or real chain).  
5. We can explain honestly that this automates **document reading / extraction**, not bank payment rails.

---

*End of architecture guide.*
