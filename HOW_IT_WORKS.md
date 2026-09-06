# How TradeDoc OCR Works  
### A plain-English guide (plus what’s happening under the hood)

**Who this is for:** anyone on the team — non-technical stakeholders, new developers, mentors.  
**Related deep dive:** [`ARCHITECTURE_AND_CODEBASE_GUIDE.md`](./ARCHITECTURE_AND_CODEBASE_GUIDE.md)  
**How to run it:** [`README.md`](./README.md)

---

## 1. Why are we building this?

### The real-world problem

In international trade, especially with a **Letter of Credit (LC)**, banks and companies exchange a thick pack of documents:

- commercial invoice  
- packing list  
- bill of lading  
- certificates of origin / insurance  
- electronics-specific papers (e.g. BIS / WPC-style certificates)

Today, a lot of that work still looks like this:

1. Someone uploads a PDF or scans paper.  
2. A human **opens every page**.  
3. They **read and re-type** important fields into a system.  
4. Another person may check the same pack again.  
5. Mistakes and mismatches cause **delays, rework, and cost**.

Banks are good at digitizing *routing* (upload → queue → maker-checker). They are still weak at *reading content* at scale.

### What we are trying to fix

We are building a **document workbench** that:

- **Reads** those packs with OCR + AI  
- **Structures** the important fields into a reviewable form  
- Keeps a **human in the loop** for approval  
- Can stamp a **tamper-evident fingerprint** (hash) for audit / integrity  

**First focus industry:** electronics LC packs — relatively structured docs, clear compliance paperwork, good MVP scope.

### What we are *not* building

| Not this | Why |
|----------|-----|
| SWIFT payment system | Different product; payments stay with banks/SWIFT |
| Full UCP 600 “legal examiner” that replaces bank judgment | Too hard / risky for MVP; humans still decide |
| “Put the whole PDF on the blockchain” | Privacy + cost; we only store **hashes**, not documents |

Think of TradeDoc as: **“smart scanner + review desk + integrity receipt”** — not “robot bank.”

---

## 2. What the product does (one sentence)

**A signed-in team uploads a trade document pack → the system reads and extracts fields → a reviewer approves → the system can record a cryptographic proof that “this exact pack + extraction existed.”**

---

## 3. How it feels to a normal user

```text
Sign in
   ↓
Upload PDF / image pack
   ↓
System runs OCR + extraction
   ↓
Open the case → review fields / pages
   ↓
Approve (if your role allows)
   ↓
Attest (write integrity hash — mock or blockchain)
   ↓
See it later under Audit
```

### Roles (simple)

| Role | Everyday meaning |
|------|------------------|
| **Operator** | Can upload and run OCR |
| **Reviewer** | Can approve after checking |
| **Admin** | Can attest / delete; manage more |
| **Owner** | Full control of the organization |

When you **register**, you create an **organization** and become its **owner**. Everyone else’s packs stay in *their* org — you don’t see other companies’ documents.

---

## 4. The journey of one document pack (layman)

Imagine you upload `electronics_lc_pack.pdf`.

1. **Upload**  
   The file is saved. The system computes a **fingerprint** (SHA-256 hash) of the exact bytes — like a digital DNA of that file. If even one pixel changes later, the fingerprint changes.

2. **Split into pages**  
   A PDF becomes page images so each page can be read separately.

3. **Read the text (OCR)**  
   Classic engines try first (PaddleOCR → Tesseract).  
   If confidence is low, **AI vision** (Gemini / Groq) looks at the page image and reads it.

4. **Classify**  
   “Is this page an invoice, packing list, bill of lading, or something else?”

5. **Extract fields**  
   Pull structured values: invoice number, amounts, dates, parties, etc., into a table the UI can show.

6. **Human review**  
   Low-confidence fields are flagged. A person checks and **approves**. The AI does **not** silently “bank-approve” the deal.

7. **Attest**  
   The system hashes the **document** and the **extraction result**, then records those hashes (mock ID or real blockchain transaction).  
   Later you can prove integrity without revealing the private PDF.

---

## 5. What’s under the hood

### Big picture

```text
┌─────────────────────┐         HTTPS / JSON          ┌──────────────────────────┐
│  apps/web           │  ←→  Authorization: Bearer     │  apps/api                │
│  Next.js UI         │      + X-Org-Id                │  FastAPI                 │
│  login, cases,      │                               │  auth · packs · OCR      │
│  upload, audit      │                               │  LLM · attestation       │
└─────────────────────┘                               └────────────┬─────────────┘
                                                                   │
                    ┌──────────────────────────────────────────────┼────────────────┐
                    │                                              │                │
                    ▼                                              ▼                ▼
           ┌────────────────┐                           ┌─────────────────┐  ┌─────────────┐
           │ SQLite /       │                           │ data/uploads    │  │ Blockchain  │
           │ Postgres       │                           │ data/ocr        │  │ (optional)  │
           │ users, orgs,   │                           │ files & pages   │  │ hash only   │
           │ packs, fields  │                           └─────────────────┘  └─────────────┘
           └────────────────┘
```

### Frontend (`apps/web`)

- **Next.js** app with pages for login, register, forgot/reset password, cases, upload, audit, settings.  
- Stores JWT **access + refresh** tokens in the browser.  
- Every pack API call sends:
  - `Authorization: Bearer <access_token>`
  - `X-Org-Id: <your organization id>`  
- **Auth guard** redirects you to `/login` if you’re not signed in.  
- UI is built in a **shadcn/ui**-style design system (sidebar, cards, dark mode).

### Backend (`apps/api`)

- **FastAPI** Python service on port **8000**.  
- Main areas:
  - `/api/v1/auth/*` — register, login, refresh, password reset, verify email  
  - `/api/v1/orgs/invite` — invite teammates  
  - `/api/v1/packs/*` — upload, process, approve, attest, delete  
- **JWT**: short-lived access token + refresh token (refresh tokens hashed in DB).  
- **RBAC**: route checks role before approve/attest/delete.  
- **Org scoping**: list/get/mutate only packs belonging to the active organization.

### Database & files

| What | Where |
|------|--------|
| Users, orgs, memberships, packs, pages, fields, audit events | SQLite (`data/ocr_platform.db`) or Postgres (`DATABASE_URL`) |
| Original uploads | `data/uploads/<org_id>/<pack_id>/` |
| OCR page images | `data/ocr/<pack_id>/` |

No MongoDB. The data is relational (packs → pages → fields).

### OCR / AI pipeline (technical)

Rough order inside `process_pack`:

1. Hash file → store `sha256` on the pack.  
2. Rasterize PDF pages (or use image as one page).  
3. Run **classic OCR**; keep text + confidence.  
4. If confidence &lt; threshold → call **vision LLM** (Gemini preferred, Groq fallback).  
5. **Classify** document type (Groq text model, or heuristic without keys).  
6. **Extract** JSON fields (Groq, or heuristic/stub offline).  
7. Mark pack `needs_review` when done (or `failed` on error).  
8. Compute `result_hash` over the structured extraction for attestation.

Without API keys, the pipeline still runs using **stubs/heuristics** so demos work offline.

### Blockchain attestation (technical)

- Smart contract: `packages/contracts` → `DocumentAttestation.sol` (Hardhat).  
- We send **hashes only** (`doc_hash`, `result_hash`), not the PDF.  
- If `CHAIN_RPC_URL` + contract address + private key are set → real on-chain tx.  
- If not → **mock** transaction id so the product flow still works in demos.

---

## 6. Why the architecture looks like this

| Choice | Simple reason |
|--------|----------------|
| Separate web + API | UI and OCR can scale/deploy independently; clear API boundary |
| Org + roles | Multi-company / multi-user product, not a single shared folder |
| Human approve step | Trade risk is high; automation assists, doesn’t silently finalize |
| Hash on chain, not documents | Privacy, cost, and auditability |
| SQLite default / Postgres optional | Easy local demo; enterprise path when needed |
| Stub OCR without keys | Anyone can run the repo without paid AI keys |

---

## 7. Mental model to remember

1. **Problem:** LC document packs are slow and error-prone to process by hand.  
2. **Product:** Multi-user workbench that reads packs and helps humans review faster.  
3. **Integrity:** Cryptographic fingerprints prove “what was checked,” without leaking files.  
4. **Stack:** Next.js talks to FastAPI; FastAPI owns OCR/AI, DB, and attestation.  
5. **Boundary:** We automate **reading/extraction/integrity** — not payments or full legal LC examination.

---

## 8. Where to go next

| Doc | Use it for |
|-----|------------|
| [`README.md`](./README.md) | Install & run |
| [`ARCHITECTURE_AND_CODEBASE_GUIDE.md`](./ARCHITECTURE_AND_CODEBASE_GUIDE.md) | Folder-by-folder + deeper design |
| [`OCR_Development_Plan_Enterprise.md`](./OCR_Development_Plan_Enterprise.md) | Broader OCR product plan |
| [`LC_Document_Processing_Research_and_Development_Plan.md`](./LC_Document_Processing_Research_and_Development_Plan.md) | Research / problem framing |

If you only remember one line: **TradeDoc turns messy trade PDFs into reviewed, structured data — with an optional tamper-evident receipt.**
