# Enterprise Development Plan  
## LC Trade Document OCR & Verification Platform (Electronics Domain)

**Date:** 22 August 2026  
**Domain (MVP):** Electronics trade LC packs  
**Product scope:** Automate **OCR + structured extraction + basic cross-field checks** of paper/PDF trade documents — **not** SWIFT payment rails or full UCP liability replacement.  
**Project type:** Blockchain-backed **audit / integrity** layer (document + result hashes), with AI OCR as the primary value.  
**UI system:** [shadcn/ui](https://ui.shadcn.com/)  

---

## 0. Executive decisions (read first)

| Decision | Choice | Why |
|----------|--------|-----|
| First commodity | **Electronics** | Bounded docs, BIS/WPC hooks, transferable core |
| What we automate now | **OCR → classify → extract → hash on-chain** | Matches “paper processing” scope |
| What we defer | Full discrepancy UCP engine, payments, eBL issuance | Avoid over-scoping MVP |
| LLM primary | **Groq (paid Developer for pilots)** | Latency + user constraint |
| LLM / vision fallback | **Gemini Flash (free for sandbox; paid later)** | Strong multimodal + higher free TPM |
| Classic OCR (required) | **PaddleOCR / Tesseract (+ optional Azure DI later)** | VLMs alone are not bank-grade OCR |
| Frontend | **Next.js 15 + shadcn/ui + Tailwind** | Enterprise polish, accessible, fast to ship |
| Blockchain role | **Immutable verification receipt** (hash + metadata) | Integrity/audit — not settlement |

---

## 1. Problem we are solving (narrow)

Banks and exporters still move **scanned / photographed / PDF** trade packs (invoice, packing list, BL, CoO, insurance, BIS/WPC proofs). Humans retype and re-read fields. Digitized banks may **route** PDFs digitally but still do **manual content reading**.

**MVP success =** upload a pack → pages become searchable text + structured JSON fields → confidence scores → human review queue → optional on-chain hash of `(doc SHA-256 + extraction result hash)`.

---

## 2. Groq vs Gemini — which should we use?

### 2.1 Short answer

| Environment | Recommendation |
|-------------|----------------|
| **Hackathon / campus sandbox / early demos** | **Hybrid free:** Gemini Flash for vision OCR of hard scans + Groq `llama-3.1-8b-instant` for cheap text cleanup/JSON |
| **Bank pilot / production** | **Classic OCR engine (primary)** + **Groq** for structured reasoning/JSON + **Gemini** as vision fallback when classic OCR confidence is low |
| **Do not** | Rely on free-tier alone for multi-user enterprise load |

**Is Gemini free?** Yes — Google AI Studio / Gemini Developer API has a **Free** usage tier (no billing required for limited quotas). Exact RPM/RPD/TPM are **model- and project-specific** and change; always read live values in [Google AI Studio rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

**Who has more free usage?** Depends on the metric:

| Metric | Groq Free (typical, org-level) | Gemini Free (typical Flash-class, project-level) | Winner for OCR demos |
|--------|--------------------------------|--------------------------------------------------|----------------------|
| Requests / day | High on small models (e.g. `llama-3.1-8b-instant` often **~14,400 RPD**); large models often **~1,000 RPD** | Flash-class often **~1,000–1,500 RPD** (verify in console) | Groq for many *text* calls |
| Tokens / minute | Often **6K–30K TPM** depending on model ([Groq rate limits](https://console.groq.com/docs/rate-limits)) | Often **~250K+ input TPM** on Flash free | **Gemini** for large page text |
| Vision / OCR | Vision models available (e.g. `qwen/qwen3.6-27b`, Llama 4 Scout-class) — **max ~5 images / request**, size caps | Native multimodal + large context | **Gemini** usually better for multi-page doc vision |
| Latency | Extremely low | Good, usually slower than Groq | **Groq** |
| Enterprise data stance | API vendor ToS apply | Strong Google Cloud compliance story when on Vertex | Vertex Gemini for banks later |

**Sources:** [Groq Rate Limits](https://console.groq.com/docs/rate-limits), [Groq Vision](https://console.groq.com/docs/vision), [Gemini Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits). Secondary blogs disagree slightly on Gemini RPD after 2025 quota changes — **treat console numbers as source of truth**.

### 2.2 Recommended production routing (OCR-focused)

```
Page image / PDF page
    │
    ├─1─► Classic OCR (PaddleOCR) ──► text + boxes + confidence
    │         │
    │         ├─ conf ≥ threshold ──► Extraction LLM (Groq text)
    │         │
    │         └─ conf < threshold ──► Vision fallback
    │                                   ├─ primary: Gemini Flash (vision)
    │                                   └─ secondary: Groq vision (Qwen / Llama 4 Scout)
    │
    └─► Structured JSON schema validation → HITL if fail
```

**Rationale:** Classic OCR is cheap, offline-capable, and stable. VLMs fill gaps (stamps, handwriting, skewed scans). Groq stays primary for fast post-OCR structuring (user preference). Gemini is the better free/paid multimodal safety net.

---

## 3. Groq models we will use

Confirm IDs in [Groq Console](https://console.groq.com/) before locking CI — model catalogs change.

| Role | Model ID | When used |
|------|----------|-----------|
| **Vision OCR / hard page** (Groq path) | `qwen/qwen3.6-27b` (current Groq vision doc default) **or** `meta-llama/llama-4-scout-17b-16e-instruct` if still available | Low-confidence pages, stamps, tables as images |
| **Classify document type** | `llama-3.1-8b-instant` | Fast: invoice vs BL vs CoO vs packing list |
| **Field extraction → JSON** | `openai/gpt-oss-20b` or `llama-3.3-70b-versatile` | Structured extraction from OCR text |
| **Light cleanup / normalize** | `llama-3.1-8b-instant` | Dates, amounts, party name normalization |
| **Prompt injection / abuse guard** (optional) | `meta-llama/llama-prompt-guard-2-86m` | Scan user-supplied notes / free text |
| **Not for OCR** | Whisper models | Audio only — out of scope |

**Gemini fallback models (sandbox):** `gemini-2.5-flash` / current Flash equivalent for vision OCR; use Flash-Lite for high-volume cheap classification if quotas allow.

### 3.1 Free-tier rate limit design assumptions (label: verify in console)

**Groq Free (illustrative from public docs — re-check org limits page):**

| Model | RPM | RPD | TPM | TPD |
|-------|-----|-----|-----|-----|
| `llama-3.1-8b-instant` | ~30 | ~14,400 | ~6,000 | ~500,000 |
| `llama-3.3-70b-versatile` | ~30 | ~1,000 | ~12,000 | ~100,000 |
| `openai/gpt-oss-20b` / `120b` | ~30 | ~1,000 | ~8,000 | ~200,000 |
| Vision-class (Scout / Qwen) | ~30 | ~1,000 | model-specific | model-specific |

Limits are **organization-wide**, not per API key. Cached prompt tokens do **not** count toward rate limits ([Groq docs](https://console.groq.com/docs/rate-limits)).

**Gemini Free:** View live RPM/TPM/RPD in AI Studio. Free tier exists; RPD often binds first for document apps. Limits apply **per project**, not per key ([Gemini docs](https://ai.google.dev/gemini-api/docs/rate-limits)).

**Implication for MVP:** One 40-page pack with per-page vision calls will **blow free RPD** quickly. Design for **async queues + classic OCR first + LLM only on extracted text / low-conf pages**.

---

## 4. Tech stack (enterprise)

### 4.1 Frontend (professional)

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** (App Router) + TypeScript |
| UI kit | **[shadcn/ui](https://ui.shadcn.com/)** (Radix + Tailwind) |
| Styling | Tailwind CSS 4 + CSS variables (bank-neutral theme: slate/ink, no purple glow) |
| Tables | TanStack Table + shadcn `DataTable` |
| Forms | React Hook Form + Zod |
| Charts (ops) | shadcn Charts / Recharts |
| Auth UI | shadcn forms + Clerk or NextAuth (OIDC later for banks) |
| File upload | UploadThing or direct S3 presign + shadcn dropzone |
| State | Server Components + TanStack Query for async jobs |
| A11y | Radix primitives (built into shadcn) |

**Frontend surfaces (MVP):**

1. **Operations Workbench** — case list, SLA badges, queue filters  
2. **Pack Viewer** — PDF/page strip + OCR text + field JSON side panel  
3. **Confidence / exception queue** — low-conf fields only  
4. **Audit trail** — who reviewed what + chain tx / hash receipt  
5. **Admin** — tenants, API keys (masked), model routing toggles  

**UX principles (enterprise):** dense but calm; maker-checker states; never hide raw PDF; every AI field shows confidence + “source page”; no consumer-chat aesthetics.

### 4.2 Backend

| Layer | Choice |
|-------|--------|
| API | **NestJS** or **FastAPI** (prefer FastAPI if ML team owns OCR; NestJS if TS monorepo) |
| Queue | **Redis + BullMQ** (or Celery + Redis) |
| DB | **PostgreSQL** + Prisma/SQLAlchemy |
| Object store | **S3-compatible** (MinIO local; AWS/GCS prod) with Object Lock option |
| Search | Postgres full-text first; OpenSearch later |
| Observability | OpenTelemetry + Prometheus + Grafana; structured JSON logs |
| Secrets | Vault / Doppler / AWS Secrets Manager |

### 4.3 OCR / IDP

| Stage | Tool |
|-------|------|
| PDF → pages | `pdf2image` / Poppler / pdfium |
| Deskew / denoise | OpenCV |
| Primary OCR | **PaddleOCR** (or Tesseract as minimal fallback) |
| Table structure | Paddle structure / camelot for born-digital PDFs |
| Born-digital PDF text | Prefer native text layer before OCR |
| Vision LLM | Gemini Flash → Groq vision |
| Schema extract | Groq text models + JSON Schema validation |

### 4.4 Blockchain (project requirement)

| Item | Choice |
|------|--------|
| Network (dev) | Hardhat local / Polygon Amoy / Sepolia |
| Network (pilot) | Private permissioned chain **or** Polygon PoS (decide with advisor) |
| Contract | `DocumentAttestation.sol` — store `bytes32 docHash`, `bytes32 resultHash`, `bytes32 packId`, `uint256 timestamp`, `address attester` |
| What is on-chain | **Hashes + metadata only** — never PII, never full PDFs |
| Off-chain | Full docs in encrypted object store; DB holds mapping `packId → URI` |
| Wallet / keys | Custodial service key for bank tenant (HSM later); not end-user MetaMask for ops clerks |

**Blockchain is integrity/audit, not LC settlement.**

---

## 5. System architecture (OCR-centric)

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js + shadcn Workbench (Maker / Checker / Admin)       │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS / OIDC
┌────────────────────────────▼────────────────────────────────┐
│  API Gateway (auth, rate limit, tenant)                     │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
     ┌─────────▼─────────┐           ┌─────────▼─────────┐
     │ Case / Pack API   │           │ Audit / Chain API │
     └─────────┬─────────┘           └─────────┬─────────┘
               │                               │
     ┌─────────▼───────────────────────────────▼─────────┐
     │              Job Queue (BullMQ)                    │
     │  ingest → preprocess → ocr → extract → attest     │
     └─────────┬───────────────┬───────────────┬─────────┘
               │               │               │
        ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
        │ OCR Workers │ │ LLM Router  │ │ Chain Worker│
        │ PaddleOCR   │ │ Groq/Gemini │ │ hash+tx     │
        └─────────────┘ └─────────────┘ └─────────────┘
               │
        ┌──────▼──────┐     ┌──────────────┐
        │ S3 / MinIO  │     │ PostgreSQL   │
        └─────────────┘     └──────────────┘
```

---

## 6. Phased development plan

### Phase 0 — Foundations (Week 1–2)

- Repo monorepo (`apps/web`, `apps/api`, `packages/ocr`, `packages/contracts`)  
- shadcn theme + layout shell (sidebar, topbar, command palette)  
- Auth stub (email magic link or Clerk)  
- Upload → S3 → `TradePack` record  
- Local Hardhat + attestation contract  
- **Exit:** upload PDF, store hash, show empty case page  

### Phase 1 — OCR MVP (Week 3–6)  ★ primary delivery

- PDF rasterization + page thumbnails  
- PaddleOCR pipeline with bbox storage  
- Document classifier (Groq 8B) for electronics pack types  
- Extract schemas: Invoice, Packing List, BL, CoO, Insurance, BIS cert  
- Confidence thresholds + exception queue UI  
- Gemini vision fallback for `conf < 0.75` pages  
- Groq vision secondary fallback  
- Unit tests on golden pages (20–50 labeled pages)  
- **Exit:** end-to-end pack → JSON fields with ≥ target field accuracy on gold set  

### Phase 2 — Enterprise hardening (Week 7–10)

- Maker-checker dual control  
- Tenant isolation, RBAC, audit log UI  
- Rate-limit aware LLM router + circuit breakers  
- Retry / DLQ dashboards  
- On-chain attestation after checker approve  
- Load test: 50 concurrent packs  
- **Exit:** pilot-ready for one exporter or bank ops desk  

### Phase 3 — Blockchain + pilot polish (Week 11–14)

- Permissioned / testnet attestation with explorer link in UI  
- Export verification PDF report (hash + tx id)  
- SOC2-oriented logging, encryption at rest docs  
- Optional Azure Document Intelligence for bank RFP checkbox  
- **Exit:** demo to stakeholders with electronics sample packs  

### Out of scope until later

- Full UCP discrepancy engine  
- Finacle deep integration  
- Oil Q&Q / Engineering multi-regime packs  
- Smart escrow / payment release  

---

## 7. Frontend plan (shadcn, enterprise)

### 7.1 Information architecture

```
/login
/app
  /cases                 → DataTable (status, SLA, domain, assignee)
  /cases/[id]            → Pack workspace
  /cases/[id]/review     → PDF + OCR overlay
  /cases/[id]/fields     → Extracted fields (editable)
  /queues/exceptions     → Low confidence only
  /audit                 → Events + chain receipts
  /settings/models       → Groq/Gemini toggles (admin)
  /settings/tenants      → Admin
```

### 7.2 Key shadcn components to use

| Screen | Components |
|--------|------------|
| Shell | `Sidebar`, `Breadcrumb`, `DropdownMenu`, `Avatar` |
| Cases | `Table`, `Badge`, `Select`, `Tabs`, `Pagination` |
| Upload | `Dialog`, `Progress`, `Alert` |
| Review | `Resizable` panels, `ScrollArea`, `Card`, `Tooltip` |
| Fields | `Form`, `Input`, `Checkbox`, `Button` variants |
| Risk | `AlertDialog` for approve/reject |
| Ops | `Sonner` toasts, `Skeleton` loading |

### 7.3 Visual direction

- Neutral enterprise: `--background` off-white / soft gray; ink text; single accent (teal or deep blue — **not** purple gradient cliché)  
- Dense tables with clear status chips: `Queued` / `OCR` / `Needs Review` / `Approved` / `Attested`  
- Always show **source page thumbnail** next to extracted value  
- Motion: subtle progress for pipeline stages only (2–3 intentional transitions)

---

## 8. Fallback mechanisms

| Failure | Detection | Fallback |
|---------|-----------|----------|
| Classic OCR crash | Worker exception | Retry 2× → Tesseract path → mark page `OCR_FAILED` for HITL |
| Low OCR confidence | Mean conf < threshold | Gemini vision OCR on that page |
| Gemini 429 / outage | HTTP 429 / 5xx | Groq vision model |
| Groq 429 / outage | HTTP 429 / headers | Gemini text/vision; exponential backoff |
| Both LLM providers down | Circuit open | Persist OCR text only; queue `EXTRACT_PENDING`; alert ops |
| Invalid JSON from LLM | Schema validation fail | Re-prompt once with repair prompt → else HITL |
| PDF corrupt / password | Ingest validation | Reject with clear UI error |
| Chain RPC down | Tx timeout | Store attestation intent in DB; retry worker; pack still usable offline |
| Object store failure | Upload error | Fail closed; no partial silent success |

**Provider router policy (code-level):**

```
primary_text   = groq
fallback_text  = gemini
primary_vision = gemini   # better free multimodal for scans
fallback_vision= groq
classic_ocr    = always_try_first
```

---

## 9. Fault tolerance

| Concern | Design |
|---------|--------|
| Worker crash | Jobs idempotent (`page_id` + `pipeline_version`); ack only after persist |
| Partial pack success | Page-level status machine; pack status = min(page states) |
| Poison messages | Dead-letter queue after N attempts; admin replay UI |
| Duplicate uploads | Content-addressed `sha256`; dedupe |
| DB vs S3 consistency | Write S3 first → DB pointer; reconciliation cron |
| Multi-instance API | Stateless API; sticky not required |
| LLM non-determinism | `temperature=0`, pinned model IDs, store `model_id` + prompt version on every field |
| Chain reorg (public testnet) | Wait N confirmations; prefer permissioned chain for pilot |
| Region outage | Multi-AZ Postgres; S3 cross-region optional Phase 3 |

---

## 10. Rate limits & capacity planning

### 10.1 Application-level limits (our API)

| Actor | Limit (starting) |
|-------|------------------|
| Authenticated upload | 20 packs / hour / user |
| Concurrent OCR jobs / tenant | 5 |
| LLM calls / pack | Cap vision pages (e.g. max 10 low-conf vision calls) |
| Burst | Token bucket + Redis |

### 10.2 Upstream handling

1. Read `retry-after` / Groq `x-ratelimit-*` headers  
2. Exponential backoff with jitter (base 1s, cap 60s)  
3. Global semaphore per provider (respect RPM)  
4. Token budget estimator before call (skip / chunk if near TPM)  
5. Prefer **batch async** overnight for bulk backfills  
6. Never fan-out 40 parallel vision calls on free tier  

### 10.3 Rough free-tier capacity (assumption — verify)

| Scenario | Classic OCR only | + Groq text extract / doc | + Vision on 25% pages |
|----------|------------------|---------------------------|------------------------|
| Demo (5 packs/day × 30 pages) | Fine | Usually fine on 8B | Tight on free vision RPD |
| Classroom (50 packs/day) | OK | Need Groq Developer or heavy caching | **Need paid** |
| Bank pilot (200 packs/day) | Self-host OCR | **Paid Groq + paid Gemini/Vertex** | Required |

---

## 11. Security & compliance (OCR product)

- Encrypt at rest (S3 SSE-KMS) and TLS in transit  
- Tenant isolation (row-level `tenant_id`)  
- No document bytes to blockchain  
- Redact before any analytics sink  
- Retain model I/O logs only as long as policy allows  
- Maker cannot approve own critical attestations (Phase 2)  
- Data residency: prefer India region for bank talks  

---

## 12. Testing & quality gates

| Gate | Target (MVP) |
|------|----------------|
| Field exact-match on gold invoices | ≥ 90% key fields |
| Doc classification accuracy | ≥ 95% |
| Median pack OCR time (30 pages) | < 8 minutes on 4-worker box |
| Pipeline success rate | ≥ 99% (excluding bad uploads) |
| Attestation success | ≥ 99.5% with retry |

Gold set: **≥ 30 electronics packs** (anonymized), labeled fields + expected doc types.

---

## 13. Team & delivery (suggested)

| Role | Focus |
|------|-------|
| FE engineer | Next.js + shadcn workbench |
| BE engineer | API, queue, auth, tenants |
| ML/OCR engineer | PaddleOCR, schemas, eval harness |
| Blockchain engineer | Contracts, attester service |
| PM / domain | Electronics LC sample packs, UAT |

---

## 14. Milestone checklist

- [ ] Monorepo + CI  
- [ ] shadcn shell + case list  
- [ ] Upload + SHA-256  
- [ ] PaddleOCR page pipeline  
- [ ] Groq classify + extract  
- [ ] Gemini vision fallback  
- [ ] Exception review UI  
- [ ] Attestation contract + worker  
- [ ] Rate-limit router + DLQ  
- [ ] Gold-set eval report  
- [ ] Pilot runbook  

---

## 15. Final stack summary (copy into README)

```text
Frontend:     Next.js 15 + TypeScript + shadcn/ui + Tailwind
Backend:      FastAPI (or NestJS) + Redis/BullMQ + PostgreSQL
OCR:          PaddleOCR (+ Tesseract fallback)
LLM primary:  Groq (8B classify, 20B/70B extract, Qwen/Scout vision)
LLM fallback: Gemini Flash (vision + text)
Storage:      S3/MinIO (encrypted)
Chain:        Solidity attestation (hashes only) on permissioned/testnet
Domain MVP:   Electronics LC document packs
```

---

## 16. Explicit non-claims

- Free Groq/Gemini tiers are **not** sufficient for production bank volume.  
- VLM OCR is **not** a full substitute for a dedicated OCR engine on stamped/faxed scans.  
- On-chain hash ≠ legal LC compliance under UCP 600.  
- Exact free RPM/RPD numbers **must** be re-read from provider consoles before every release.

---

*Companion research: `LC_Document_Processing_Research_and_Development_Plan.md`*
