# Letter of Credit (LC) Document Processing in Indian Banks  
## Enterprise Research Report + Groq-Based Development Plan

**Workspace:** `C:\Users\Nachiket\OneDrive\Desktop\BCT`  
**Date:** 22 August 2026  
**Scope constraint:** Automating **paper/document processing** for LC trade finance — **not** the full banking/payment rail (SWIFT settlement, core ledger posting, title transfer).  
**Model constraint:** Primary LLM/VLM inference via **Groq API**.  
**Evidence policy:** Interview anecdotes from project synopses are treated as **hypotheses**. Every material claim is labeled: **Verified** | **Industry estimates** | **Interview-anecdotal** | **Researcher's inference** | **Not available** | **Unverified**.

---

## Evidence labels (used throughout)

| Label | Meaning |
|--------|---------|
| **Verified** | Confirmed via primary/official or high-quality secondary source (RBI/ICC/bank schedules/vendor docs/reputable research) |
| **Industry estimates** | Credible industry surveys/consulting/ICC briefings with stated ranges |
| **Interview-anecdotal** | Appears in user synopses/interview notes; not independently confirmed |
| **Researcher's inference** | Logical synthesis from multiple sources; not a direct quote |
| **Not available** | Could not locate a public source |
| **Unverified** | Claim exists in circulation but evidence is weak, contradictory, or marketing-only |

---

## Executive Summary (key findings)

1. **Credible automation opportunity exists — but only for document intelligence + human-in-the-loop discrepancy assistance**, not for replacing UCP 600 bank liability or payment rails. (**Researcher's inference**, grounded in ICC discrepancy rates + bank product gaps.)
2. **UCP 600 Article 14(b) gives each examining bank a maximum of five banking days** after presentation to determine compliance — a hard legal ceiling, not a “typical processing SLA.” (**Verified** — ICC UCP 600.)
3. **First-presentation discrepancy/refusal rates of ~65–80%** remain an industry problem per ICC Technical Advisory Briefing No. 3 — strong ROI driver for pre-check / AI-assisted examination. (**Industry estimates** — ICC TAB-3 via Trade Finance Global reporting.)
4. **₹75,000–₹80,000 “US→India LC cost” is not a verified flat document-processing fee.** Published Indian bank schedules price LC services mainly as **percentage commissions + SWIFT/docs minima**. ₹75–80k is *plausible* as all-in customer commission on a mid-size FCY LC, but **not verified as labor cost per presentation**. (**Interview-anecdotal** for the figure; **Verified** that pricing is commission-based.)
5. **“Oracle’s Finacle” is incorrect.** Finacle is **Infosys / EdgeVerve**. Oracle’s competing stack is typically **Flexcube**. (**Verified**.)
6. **“Infosys Fincore” appears to be a naming confusion** with **Finacle** and/or **Finacus FinCORE** (unrelated CBS vendor). (**Verified** confusion; no Infosys “Fincore” trade product found.)
7. **500–700 pages per trade is not supported by mainstream industry benchmarks.** McKinsey cites **~50 sheets** exchanged with **~30 stakeholders** for a shipment; user’s engineering workflow doc cites **>20 distinct documents**. High page counts may occur in commodity/project packs with annexures, but should not be treated as the default LC baseline. (**Industry estimates** vs **Interview-anecdotal**.)
8. **Digitization ≠ AI verification.** Platforms like Finacle Trade Connect, Contour, and ICICI TradeChain reduce cycle time via digital routing/shared ledgers; **content examination against LC terms + ISBP still needs rules + IDP/LLM + humans**. (**Verified** conceptually; Finacle/Infosys now also market AI extraction — still not a substitute for bank examination liability.)
9. **Private banks show more public digital trade products** (ICICI TradeChain, Contour pilots with HDFC/ICICI, India Trade Connect). Claiming “only ICICI/HDFC/Axis = 1–2 days; SBI/PNB fully manual” is an **oversimplification** — SBI is in blockchain consortia; cycle-time claims are often for **domestic / network** flows, not all cross-border paper LCs. (**Partially verified** digital leadership; **Unverified** clean private-vs-PSU split.)
10. **Build recommendation:** Enterprise **IDP + rules engine + Groq LLM/VLM discrepancy co-pilot + maker-checker UI + immutable audit log**, with **optional** later hash ledger. Defer full blockchain/smart-escrow/payment automation from synopsis aspirations for MVP. (**Researcher's inference** aligned to user product constraint.)

---

## 1. LC Trade Finance Overview

### 1.1 What an LC is (operational definition)

A **documentary Letter of Credit** is a bank undertaking to pay the beneficiary against a **complying presentation of documents**, independent of the underlying sale contract (UCP 600 principle of autonomy). Banks examine documents **on their face**; they do not inspect goods. (**Verified** — ICC UCP 600 framework.)

### 1.2 Key instruments and messages

| Artifact | Role | Evidence |
|----------|------|----------|
| SWIFT **MT700** | Issue documentary credit | **Verified** industry standard |
| SWIFT **MT705** | Pre-advice of credit | **Verified** message type; preferred over free-format “PoF” narratives |
| SWIFT **MT799** | Free-format bank-to-bank | **Verified** exists; **not** a payment instrument / PoF substitute (**Industry practice** + user’s oil forensic doc) |
| **eUCP** / **ISBP 745** | Electronic presentation rules / examination practice | **Verified** ICC publications |
| ISO **20022** (pacs.008/009) | Payment settlement messages | **Verified** messaging standard; **out of product scope** for this build |

### 1.3 Problem the user’s synopsis says they are solving

From `Project Synopsis.pdf`, `AI_Trade_Document_Verification_Synopsis.docx`, and `Synopsis.pdf`:

- **Bottleneck:** Manual verification of large document packs at presentation / settlement.
- **Gap:** Core/trade systems (**Finacle-class**) primarily **route** work via maker-checker; clerks still do line-by-line checks under UCP liability.
- **Proposed product:** AI platform that **ingests existing documents**, cross-verifies, flags discrepancies/fraud signals across **Electronics, Mechanical/Engineering, Oil**.
- **Explicit out of scope (synopsis):** Generating/replacing legal instruments (BL, LC, CoO); creating title; acting as payment rail.
- **Blockchain in synopsis:** Permissioned hash/audit layer only — not eBL issuance.

**Assessment:** Synopsis problem statement is directionally sound for a document-intelligence product. Several quantitative baselines inside it are **Interview-anecdotal** and must not be treated as facts (see §20).

### 1.4 Definitions (keep scope honest)

| Term | Meaning |
|------|---------|
| **Digitization** | Scans/PDFs/portal upload; electronic transmission; less paper courier |
| **STP (straight-through processing)** | End-to-end auto-processing without human touch — rare for complex LC packs |
| **IDP (intelligent document processing)** | Classify + OCR/extract + validate fields |
| **AI-assisted examination** | Models propose discrepancies; humans decide |
| **End-to-end trade automation** | Includes escrow, settlement, title, logistics oracles — **beyond** this product’s constrained scope |

---

## 2. Document Workflow (stage-by-stage)

### 2.1 Generic LC lifecycle (bank-centric view)

```
Pre-trade (RFQ/PO/Contract)
    → LC application → Issuing bank MT700
    → Advising/confirming bank advises beneficiary
    → Manufacture / compliance / shipment
    → Document compilation by exporter
    → Presentation to nominated/advising bank
    → Examination (UCP Art. 14) → honor / refuse / waiver cycle
    → Documents forwarded to issuing bank → examination again
    → Payment / acceptance → document release to applicant
```

**Automation sweet spot for this product:** stages from **document package assembly / pre-check** through **bank examination assistance** (both banks). Not LC issuance pricing engines or SWIFT payment posting.

### 2.2 Mapping user’s Bank EBL / Export Quotation flows

**Sources:** `Bank Ebl Flow-2026-07-11-091724.pdf`, `Bank Ebl Flow-2026-07-12-110825.pdf`, `Export Quotation Process-2026-07-12-113650.pdf`.

| Phase (user docs) | Typical artifacts | Bank document-check relevance |
|-------------------|-------------------|-------------------------------|
| Pre-trade negotiation | RFQ, quotation, PO, proforma, sales contract (Incoterms 2020) | Low for UCP exam (contract ≠ LC), useful for **consistency** features |
| LC issuance | Documentary LC application, MT700, advice, acceptance | Parse **Field 45A/46A/47A** as ground truth for later checks |
| Manufacturing & compliance | Inspection, BIS/ISO, CoC | Domain modules |
| Export documentation | Invoice, packing list, CoO, insurance, eBL, shipping bill/IEC | Core presentation pack |
| Trade validation | Validate UCP conditions, PO vs invoice, verify docs, validation report | **Primary product surface** |
| Registration / visibility | Audit record, ETA, PoD | Audit trail / ops UX |
| Settlement | Settlement instruction, ISO 20022 payment, credit beneficiary | **Out of scope** (consume status events only) |

**Important correction from oil forensic analysis (user doc):** Do not treat **MT799 as Proof of Funds**. Prefer **MT705** pre-advice + **MT700** operative credit. (**Verified** SWIFT typology; user’s oil doc correctly flags MT799 misuse.)

### 2.3 Commodity-specific document packs

#### A) Electronics (from `Electronic Goods - Detailed (2).pdf` + Bank EBL flow)

**Regulatory / compliance extras (India import example):** BIS CRS, WPC ETA / import license, CPCB EPR; plus international CE/FCC/RoHS as applicable.  
**Typical presentation-adjacent set:** Commercial invoice, BL/eBL, packing list, CoO, insurance, lab CoC / test report, BIS/WPC/CPCB evidences, dual-use/SCOMET filings when relevant.  
**LC field hooks (user electronics flow):** Field 45A goods/specs matching BIS registry; Field 46A required permits; Field 47A EPR QR verification.  
**Label:** Domain document list = **Researcher's inference** from user domain research + public Indian compliance regimes (BIS/WPC/CPCB are **Verified** Indian regulatory bodies; exact LC clause patterns vary by deal).

#### B) Oil / petroleum (from `Verifying Oil Trade Documentation Phases.docx`)

**UN/CEFACT-aligned set (user table):** PO, commercial invoice, eBL, packing list (tank/density data), insurance, TSR, dangerous goods declaration, customs declaration, CoO, LC, payment confirmation.  
**Inspection-critical:** SGS/Intertek/Saybolt **Q&Q** (API gravity, sulfur, density, BS&W, temp-corrected volumes).  
**High fraud vectors flagged in user forensic audit:** Fake TSR/DTA circulation, tank-extension fees, forged inspection PDFs, MT799-as-PoF scams.  
**Bank examination reality:** Banks still examine **documents on their face** under UCP; physical tank truth needs inspector APIs / ops controls beyond pure OCR. (**Verified** UCP face examination; fraud controls = **Researcher's inference**.)

#### C) Regional engineering / mechanical (from `Regional Engineering Export Compliance & Phase Workflows-3.pdf`)

**User claim:** “more than **20 distinct** documents” including invoice, packing list, insurance, port slips, BLs, conformity docs. (**Interview-anecdotal / author estimate** in domain paper.)  
**Compliance stack:** NABL lab reports, ARAI/iCAT type approval for auto components, UNECE E-mark / ISO baselines, destination marks (UL/ASME/CE etc.).  
**Phased workflow (user):** (1) Contract/onboarding → (2) LC issuance → (3) manufacturing & testing → (4) port/customs/eBL → (5) presentation + AI validation.  
**Engineering export scale context (user paper):** Engineering exports cited at **USD 122.43 bn** FY2025-26 — treat as **Unverified** unless cross-checked against DGFT/EEPC official releases for the build’s marketing; useful only as market-sizing hypothesis.

### 2.4 Where humans spend time today (hypothesis vs evidence)

| Activity | Interview hypothesis | Evidence status |
|----------|---------------------|-----------------|
| Line-by-line field matching vs LC | Heavy | **Industry practice** (UCP/ISBP) |
| Cross-doc consistency (qty, dates, names, ports) | Heavy | **Verified** common discrepancy class (ICC/ISBP commentary) |
| Certificate authenticity | Medium–high | Banks limited on face exam; deep authenticity often **out of band** |
| Discrepancy notice drafting / waiver loops | High calendar delay | **Industry estimates** (65–80% first refusal) |

---

## 3. Document Volume

### 3.1 Interview claim

**Claim:** 500–700 papers/documents per trade before payment.  
**Label:** **Interview-anecdotal** (repeated across synopses). Ambiguous whether “papers” = **pages** or **documents**.

### 3.2 External benchmarks

| Source | Figure | Label |
|--------|--------|-------|
| McKinsey (trade documentation / eBL analysis) | Up to **~50 sheets** per shipment; up to **~30 stakeholders** | **Industry estimates** |
| User engineering domain paper | **>20 distinct documents** | **Author estimate** in user corpus |
| Contour / Citi India press | Focus on cycle time, not page count | N/A |
| Oil / project finance packs | Can balloon with lab annexures, SOF, Q88, multiple originals | **Researcher's inference** |

### 3.3 Assessment

| Scenario | Plausible volume | Confidence |
|----------|------------------|------------|
| Standard containerized LC presentation | **15–40 documents**, often **30–80 pages** after scans/duplex/stamps | **Researcher's inference** |
| Electronics with multi-cert annexures | **25–60 documents**; pages higher if lab reports attached | **Researcher's inference** |
| Oil tanker cargo | **20–50+ documents**; Q&Q annexures can push **page** count into low hundreds | **Researcher's inference** |
| 500–700 **pages** as routine India import LC | **Not supported** by McKinsey-scale benchmarks; possible only as outlier (bulk copies, full lab binders, multi-container project) | **Unverified as baseline** |
| 500–700 **documents** | **Implausible** for a single LC presentation | **Unverified / likely false** |

**Implication for product:** Size OCR/LLM pipelines for **tens of documents / low hundreds of pages** as base case; support “large pack” mode for oil/project without baking 500–700 into ROI.

---

## 4. Processing Time

### 4.1 UCP 600 clock (**Verified**)

- **Article 14(b):** Each nominated / confirming / issuing bank has a **maximum of five banking days following the day of presentation** to determine if presentation complies.
- Clock is **per bank**, not shared.
- Not shortened by LC expiry occurring after presentation.
- Failure to refuse in time can **preclude** discrepancy claims (Art. 16(f) practice).

Source: ICC UCP 600 Article 14 (ICC Digital Library / standard commentary).

### 4.2 Interview claim: 5–7 days

**Label:** **Interview-anecdotal** as “current workflow duration.”

**What it might actually mix (Researcher's inference):**

1. UCP examination window (≤5 banking days **per bank**).
2. Courier / queue / backlog **calendar** days.
3. Discrepancy → applicant waiver → re-presentation loops.
4. End-to-end “ship arrives → money credited” narrative (includes non-exam steps).

### 4.3 External cycle-time claims

| Claim | Source | Label | Caveat |
|-------|--------|-------|--------|
| Document presentation usually **5–10 days**; Contour case **~3 hours** | Citi India Contour press (2023) | **Verified as press claim** | Domestic blockchain LC pilot — not all cross-border paper |
| LC cycle **8–9 days → 2–3 days** | Infosys Finacle Trade Connect marketing | **Vendor claim** | Network/digitized flows |
| Contour “up to 90%” reduction | Contour / partner materials | **Vendor claim** | Requires digital network adoption |
| ICICI/HDFC/Axis “1–2 days” vs SBI/PNB lag | Synopses | **Interview-anecdotal** | Over-generalized (see §7) |

### 4.4 Assessment

- Treating **5–7 calendar days** as a universal Indian bank baseline is **Unverified**.
- Treating **≤5 banking days** as the **examination SLA ceiling** is **Verified**.
- Product KPI should track: **touch time**, **queue time**, **examination elapsed banking days**, **first-pass yield**, separately.

---

## 5. Human Resources

### 5.1 Interview hypotheses

| Claim | Label |
|-------|-------|
| ~1 senior + ~6 juniors per receiving-bank final phase | **Interview-anecdotal** |
| ~6 people on buyer-bank final phase | **Interview-anecdotal** |
| 2–3 hours active processing per person | **Interview-anecdotal** |
| Salaries ₹1.2–1.5L senior / ₹35–50k junior | **Interview-anecdotal** |

### 5.2 Partial external anchors

| Evidence | Figure | Label |
|----------|--------|-------|
| SBI Trade Finance Officer (MMGS-II) pay scale in 2026 recruitment materials | Basic **₹64,820–₹93,960**; metro gross often cited ~**₹1.0–1.07L** before deductions | **Verified** (SBI recruitment notice / secondary summaries of same) |
| Broader “trade finance specialist” market medians | Wide LPA ranges in aggregator sites | **Unverified** for LC clerk teams (noisy web salary boards) |
| Public org charts for “6 juniors per LC” | — | **Not available** |

### 5.3 Assessment

- Senior metro specialist/officer all-in near **₹1L+/month** is **plausible**; exact **₹1.2–1.5L** for “LC senior examiner” is **Unverified**.
- Junior **₹35–50k** is **plausible** for clerical/ops associates in India banking ops, but **Not available** as LC-specific published scale.
- Headcount of **6–7 per trade** may describe a **shared pool** capacity model, not six FTEs exclusively assigned to one LC. Treat staffing model as **hypothesis for ROI sensitivity**, not fact.

**Active processing 2–3 hrs/person:** Compatible with McKinsey’s “BL process alone can take six hours across stakeholders,” but **not verified** for Indian bank back-offices.

---

## 6. Technology Landscape (Finacle and others)

### 6.1 Finacle ownership (**Verified**)

- **Finacle** = digital banking suite from **EdgeVerve Systems**, wholly owned subsidiary of **Infosys**.
- **Not Oracle.** Oracle’s trade/core competitor commonly referenced is **Flexcube**.
- Synopsis phrase “Oracle’s Finacle” is a **factual error**.

### 6.2 What Finacle does in trade

From Finacle / Infosys public materials:

- Trade product lifecycle, limits, fees, messaging integration, maker-checker / four-eye controls, audit trails.
- **Finacle Trade Connect:** blockchain network digitizing inter-org trade workflows; marketing claim **8–9 → 2–3 days** LC cycle for India Trade Connect participants.
- Infosys also markets **AI-enabled document classification & extraction** for trade deals with maker-checker UI.

**Assessment:** Interview claim “Finacle only routes, never validates content” is **oversimplified**. Historically ops are routing-heavy; modern Infosys collateral claims IDP/AI assists — but **UCP liability still sits with the bank**, and deep discrepancy reasoning remains a product gap competitors (e.g., Cleareye.ai class) also target. Label: **Partially outdated interview framing**.

### 6.3 “Fincore” confusion (**Verified confusion**)

| Name | Reality |
|------|---------|
| **Finacle** | Infosys/EdgeVerve |
| **FinCORE** | Core banking product from **Finacus Solutions** (separate company) |
| **Infosys Fincore** | **Not found** as Infosys trade product |

### 6.4 Other relevant platforms (India / global)

| Platform | Role | Label |
|----------|------|-------|
| ICICI **TradeChain** | Digital domestic LC lifecycle portal | **Verified** (ICICI site) |
| **Contour** | Multi-bank digital LC network (Corda lineage) | **Verified** pilots in India (e.g., Citi–Cummins) |
| **India Trade Connect / IBBIC** | Bank consortium blockchain infra | **Verified** press |
| Oracle **Flexcube** TF | Competing CBS/trade stack | **Verified** vendor category |
| Intellect **iGTB**, Finastra, Surecomp, Bolero, WaveBL | TF / eBL / channel | **Industry landscape** |
| Cleareye.ai (and peers) | AI document checking niche | **Industry landscape** |

### 6.5 Digitization ≠ AI automation (**Verified distinction**)

| Capability | Digitized portal / DLT | AI document verification |
|------------|------------------------|--------------------------|
| Upload / share PDFs | Yes | Uses as input |
| Reduce courier time | Yes | Indirect |
| Parse fields from messy scans | Limited / optional | Core |
| Cross-check invoice vs BL vs LC 46A | Rules if structured | IDP + rules + LLM |
| Decide honor/refuse under UCP | Human/bank | Human/bank (assisted) |
| Post pacs.008 settlement | Separate payments stack | Out of scope |

---

## 7. Bank Digitalization Comparison (evidence only)

| Bank | Evidence of trade digitization | Evidence of “1–2 day” exam | Manual lag claim |
|------|--------------------------------|----------------------------|------------------|
| **ICICI** | TradeChain; Contour/India Trade Connect participation; Finacle Trade Connect corporate onboarding claims; 250+ trade APIs cited in market reports | Vendor/press speed claims for **digital** flows | **Not** “fully automated examination” |
| **HDFC** | Contour PoCs; India Trade Connect / IBBIC membership; public trade fee schedules digitized | **Not available** as universal SLA | **Unverified** that all LC ops are 1–2 days |
| **Axis** | India Trade Connect quotes on Finacle pages; trade SoC published | **Not available** as universal SLA | Same |
| **SBI** | Member of IBBIC blockchain company with private banks; Finacle ecosystem user historically; recruiting Trade Finance Officers | **Not available** | “Fully manual” is **Unverified / likely false** as absolute |
| **PNB** | Public procurement signals for trade portals historically; Finacle CBS user narratives | **Not available** | Digitization maturity may lag **leaders**, but blanket “manual only” **Unverified** |

**Bottom line:** Private banks are **more visible** in product marketing and API-led corporate channels. A binary “private = 1–2 days AI-ready; PSU = 5–7 day paper” is **not evidence-based**. Prefer: **channel digitization maturity varies**; **document AI examination** is still an overlay opportunity across the board.

---

## 8. Manual vs Digitized vs AI-Assisted (comparison)

| Dimension | Manual paper | Digitized (portal/DLT) | AI-assisted IDP (this product) |
|-----------|--------------|------------------------|--------------------------------|
| Intake | Courier / counter | Upload / network share | Upload + email/SFTP connectors |
| Classification | Human | Folder/metadata | ML/LLM classifiers |
| Extraction | Human typing | Structured e-docs if available | OCR + VLM + templates |
| LC vs docs check | Human ISBP | Partial rules if data structured | Rules engine + LLM rationale |
| Cross-doc reconciliation | Human | Limited | Core feature |
| Domain compliance (BIS/Q&Q/NABL) | Specialist knowledge | Checklist uploads | Domain rule packs + registry lookups |
| Decision | Maker-checker | Maker-checker | Maker-checker **with** AI findings |
| Audit | Paper files / CBS logs | Platform logs | Field-level evidence + model versioning |
| Liability | Bank | Bank | Bank (tool is decision-support) |
| Typical failure mode | Missed discrepancy / slow | Digital but still unread | Hallucinated discrepancy / OCR miss |

---

## 9. Cost Model (low / base / high)

> All figures are **labeled assumptions** for engineering ROI modeling. Do **not** present as audited bank COGS.

### 9.1 What ₹75–80k likely is (and is not)

**Interview claim:** US→India LC costs ₹75k–₹80k one-way.  
**Label:** **Interview-anecdotal**.

**Verified pricing pattern:** Indian banks publish **commission % p.a. / FEDAI-IBA linked charges**, SWIFT fees, documentation minima — not a universal ₹75k flat “processing fee.”

Examples (**Verified** as published schedule patterns; amounts vary by customer sanction):

- **HDFC** trade SoC (effective May 2024 per bank page summaries): FCY LC issuance commission per FEDAI/IBA with **min ~₹2,000**, documentation ~₹1,500, SWIFT ~₹2,000 class fees.
- **Axis** FX/trade SoC (Aug 2024 PDF): inland LC opening often **~1.5% p.a.** (minima apply); import LC commitment/usance structures; SWIFT ~₹1,000 class fees; advising fees ~₹1,500 customer tier.
- **ICICI:** LC/BG commission marketed **up to ~2% p.a.** pro-rata in business loan charge disclosures (facility-specific).

**Researcher's inference:** ₹75–80k can appear as **all-in customer commission** on a mid-ticket FCY LC (amount × rate × tenor) **plus** confirmation/advising — **not** the marginal cost of junior clerks reading documents.

### 9.2 Bank internal cost model (for automation ROI)

Assumptions — **explicitly hypothetical**:

| Driver | Low | Base | High | Label |
|--------|-----|------|------|-------|
| Examiner touch hours / presentation (all staff) | 4 h | 10 h | 24 h | **Interview-anchored inference** |
| Fully loaded ops cost / hour | ₹400 | ₹700 | ₹1,200 | **Researcher's inference** |
| Labor cost / presentation | ₹1,600 | ₹7,000 | ₹28,800 | Derived |
| Discrepancy rework probability | 40% | 65% | 80% | **Industry estimates** band (ICC) |
| Extra days of delay cost to corporate (opportunity) | — | Material but bank-external | — | Exclude from bank COGS unless selling to corporates |
| Courier / scanning | ₹200 | ₹800 | ₹2,500 | **Industry rough** |

**Product should monetize:** reduced touch hours, higher first-pass yield, faster queue throughput, lower operational risk — **not** “capture the ₹75k fee.”

### 9.3 Software cost stack (build-side, annualized illustrative)

| Item | Low | Base | High | Notes |
|------|-----|------|------|-------|
| Groq inference / 10k packs | see §19 | see §19 | see §19 | Token assumptions |
| OCR (Textract/Azure/Google) | $0.5–2 / 1k pages | mid | high | If not pure open OCR |
| Hosting (VPC) | $8k | $25k | $80k | Depends on bank residency |
| Audit logging / KMS / SIEM | $3k | $15k | $60k | Enterprise |
| Human review ops (pilot) | 1 FTE | 2–3 FTE | 5 FTE | Bank or vendor BOAT |

---

## 10. Automation Opportunities

| Layer | Technique | Applies to | Priority |
|-------|-----------|------------|----------|
| Ingestion | SFTP, API, email gateway, scanner batches | All domains | P0 |
| Preprocess | Deskew, denoise, page split, blank drop | Scans | P0 |
| OCR / IDP | Layout OCR + table extraction | Invoices, packing lists | P0 |
| Classification | Lightweight classifier / Groq | Mixed packs | P0 |
| Structured parse | Template + JSON schema for MT700/46A | LC terms | P0 |
| Rules engine | Deterministic UCP/ISBP-inspired checks | Dates, amounts, ports, required docs | P0 |
| LLM reasoning (Groq) | Ambiguous clause interpretation, discrepancy narrative | Edge cases | P0 |
| VLM (Groq vision-capable models when available) | Stamps, seals, handwritten endorsements | Fraud heuristics | P1 |
| CV | Signature presence, stamp region | Optional | P2 |
| Registry connectors | BIS/WPC/CPCB/NABL/inspector APIs | Domain authenticity | P1 |
| Workflow | Queues, SLA clocks, maker-checker | Bank ops | P0 |
| Agentic | Tool-calling checkers orchestrated | Multi-doc plans | P1 |
| Hash audit | SHA-256 + WORM store; optional DLT later | Compliance | P1 (DLT P2) |

**Do not automate blindly:** honor/refuse legal decision; sanctions final disposition; payment release.

---

## 11. Human-in-the-Loop Requirements

UCP liability and Indian banking control culture require **maker-checker** retention.

| Decision | AI may | Human must |
|----------|--------|------------|
| Field extraction confidence | Propose + confidence | Confirm low-confidence fields |
| Discrepancy candidate | Cite docs + LC clause | Accept / reject / waive propose |
| Missing required doc (46A) | Flag | Confirm completeness |
| Fraud heuristic (forged SGS layout) | Score + explain | Escalate to fraud desk |
| Auto-clear “clean” pack | Only if policy allows + dual control | Checker still signs for production banks |
| Customer discrepancy notice | Draft text | Approve wording |

**Enterprise controls:** role-based access, dual control, immutable audit, model version pin, prompt/toolchain change management, four-eyes on rule-pack edits.

---

## 12. ROI Model

### 12.1 Value levers

1. **Touch-time reduction** on first examination.  
2. **First-pass yield** improvement (catch exporter errors **before** formal presentation).  
3. **Queue compression** inside the 5-banking-day ceiling (risk reduction).  
4. **Training leverage** (juniors guided by AI rationales).  
5. **Corporate pre-check SaaS** (exporter-facing) — often easier beachhead than bank core.

### 12.2 Illustrative bank ROI (base assumptions — labeled)

Assume **2,000 presentations / year** at a mid-size trade hub:

| Metric | Baseline | AI-assisted | Source type |
|--------|----------|-------------|-------------|
| Touch hours / pack | 10 | 4 | **Assumption** |
| Loaded ₹ / hour | 700 | 700 | **Assumption** |
| Labor ₹ / pack | 7,000 | 2,800 | Derived |
| Annual labor | ₹1.4 Cr | ₹0.56 Cr | Derived |
| Gross annual savings | — | **~₹0.84 Cr** | Before software cost |
| Software + Groq + OCR | — | ₹0.25–0.60 Cr | **Assumption** |
| Net | — | Positive in base if adoption real | **Researcher's inference** |

**Sensitivity:** If touch hours are only 3–4 today, ROI collapses — **validate with time-motion study in discovery**.

### 12.3 Exporter-side ROI (often stronger early)

- Avoid discrepancy fees (user engineering paper cites **~$75–100** per error — **Unverified** universally; fees are bank-specific).  
- Avoid re-presentation delays (working capital).  
- Pre-validate BIS/WPC/NABL artifacts before bank submission.

---

## 13. Risks and Regulatory Constraints

| Risk / constraint | Implication |
|-------------------|-------------|
| **UCP 600 bank liability** | Tool = decision support; cannot claim “auto-honor” |
| **RBI / bank IT outsourcing / data localization** | Prefer India-region processing; contractual audit rights |
| **IT Act / title documents** | Synopsis correctly avoids issuing negotiable instruments; hashing OK if no title creation |
| **Sanctions / AML** | Keep screening systems authoritative; AI is adjunct |
| **Model hallucination** | Never write discrepancies without document span citations |
| **Confidential trade data** | Encryption, tenant isolation, no training on customer data without contract |
| **eUCP / eBL legal recognition** | MLETR / local law variance — support PDFs now; eBL adapters later |
| **Vendor lock / Groq availability** | Abstraction layer + fallback provider |
| **Over-scoped blockchain** | Delays MVP; optional phase |

---

## 14. Research Gaps (unverified interview claims)

Priority gaps to close in discovery (bank interviews / time studies / sample packs):

1. Exact meaning of ₹75–80k (commission vs ops cost vs all-in).  
2. Pages vs documents distribution by commodity (electronics / engineering / oil).  
3. Actual FTE allocation model (pool vs per-deal).  
4. Measured touch minutes by document type.  
5. Private vs PSU **examination** SLAs on **paper** cross-border LCs (not digital domestic).  
6. Which CBS/trade module is live (Finacle TF vs others) at target pilot bank.  
7. Current OCR/IDP already licensed (avoid duplicating Infosys AI module).  
8. Discrepancy fee schedules at target banks.  
9. Willingness to auto-clear zero-discrepancy packs.  
10. Data residency + outbound Groq API acceptability (or need for VPC / self-host fallback).

---

## 15. Final Assessment

**Is there a credible automation opportunity?**  
**Yes — with a scoped product thesis.**

**Credible:** IDP + deterministic rules + Groq-assisted discrepancy reasoning + maker-checker UX for LC presentation packs, especially multi-domain compliance docs (electronics / engineering / oil). High ICC discrepancy rates and slow paper chains create willingness-to-pay for **pre-check** and **examiner copilots**.

**Not credible (as near-term claims):**  
- Replacing bank UCP examination liability.  
- Guaranteeing 1–2 day settlement across SBI/PNB via AI alone.  
- Assuming 500–700-page packs as the default economic unit.  
- Treating Finacle as “Oracle routing-only with zero AI roadmap.”  
- End-to-end smart-escrow + satellite payment release as the MVP (synopsis aspiration ≠ user build constraint).

**Verdict:** Enterprise-grade **document processing automation** is a sound build; keep blockchain/payment/oracle layers phased and optional.

---

## 16. Problem Statement (what WE are solving)

### 16.1 Problem

Indian and India-corridor LC settlement still depends on humans comparing **large, heterogeneous document packs** against LC terms (UCP 600 / ISBP 745), under time pressure and high first-presentation discrepancy rates. Existing bank digitization primarily improves **transport and workflow routing** of documents; it does not reliably automate **content-level cross-document verification**, especially for domain certificates (BIS/WPC/CPCB, NABL/ARAI, SGS Q&Q).

### 16.2 Solution thesis (constrained)

Build an enterprise **Trade Document Intelligence Platform** that:

1. Ingests LC terms + presentation documents (PDF/scan/e-doc).  
2. Classifies and extracts structured fields.  
3. Runs deterministic reconciliation + domain rule packs.  
4. Uses **Groq** LLMs/VLMs for ambiguous reasoning and human-readable discrepancy rationales.  
5. Presents maker-checker queues with audit-grade evidence.  
6. Optionally records verification hashes for tamper-evidence.

### 16.3 Non-goals

- Issuing/amending LCs; SWIFT payment initiation; core accounting posting.  
- Creating electronic title / eBL issuance network.  
- Guaranteeing cargo quality/quantity beyond documentary + registry checks.  
- Fully unsupervised STP for all presentations in v1.

---

## 17. Solution Architecture (enterprise-grade)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CHANNEL LAYER                                │
│  Bank portal UI │ Exporter pre-check UI │ SFTP │ Email │ API gateway │
└──────────────────────────────────────────────────────────────────────┘
                                      │
┌──────────────────────────────────────────────────────────────────────┐
│                      INGESTION & SECURITY                            │
│  AuthN/Z (OIDC) │ DLP │ malware scan │ encryption │ tenant isolation │
└──────────────────────────────────────────────────────────────────────┘
                                      │
┌───────────────┐   ┌────────────────────────┐   ┌─────────────────────┐
│ Object store  │→ │ Preprocess / OCR-IDP   │→ │ Doc classifier      │
│ (WORM option) │   │ (layout, tables)       │   │ (invoice/BL/CoO…)  │
└───────────────┘   └────────────────────────┘   └─────────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │     Extraction & Normalization     │
                    │  JSON schemas · KTDDE-aligned IDs  │
                    └─────────────────┬─────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
 ┌─────────────────┐      ┌────────────────────┐      ┌──────────────────┐
 │ LC Terms Store  │      │ Rules Engine       │      │ Groq Reasoning   │
 │ (46A/45A/47A)   │      │ (deterministic)    │      │ (LLM/VLM/tools)  │
 └─────────────────┘      └────────────────────┘      └──────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │ Cross-Doc Reconciliation Graph     │
                    │ + Domain modules (Elec/Eng/Oil)    │
                    └─────────────────┬─────────────────┘
                                      │
                    ┌─────────────────▼─────────────────┐
                    │ Discrepancy Service + Case Mgmt    │
                    │ confidence · citations · severity  │
                    └─────────────────┬─────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
 ┌─────────────────┐      ┌────────────────────┐      ┌──────────────────┐
 │ Maker-Checker UI│      │ Audit / Hash log   │      │ Bank CBS adapter │
 │ HITL queues     │      │ (DB + optional DLT)│      │ (status only)    │
 └─────────────────┘      └────────────────────┘      └──────────────────┘
```

### 17.1 Core modules

1. **Ingestion Service** — multipart upload, hash-on-write, virus scan.  
2. **OCR/IDP Service** — page OCR, table extraction; route born-digital PDFs to text layer first.  
3. **Classification Service** — document type taxonomy per domain.  
4. **Extraction Service** — field schemas (invoice#, BL#, vessel, ports, qty, Incoterms, cert IDs).  
5. **LC Parser** — MT700/PDF application forms → structured conditions.  
6. **Rules Engine** — required docs, date logic (shipment/presentation/expiry), amount math, consignee consistency, temp-corrected oil quantities.  
7. **Groq Orchestrator** — prompt templates, tool calls (`get_field`, `compare`, `cite`), JSON output validation, retries.  
8. **Domain Packs** — Electronics / Engineering / Oil rule + prompt libraries.  
9. **HITL Workbench** — side-by-side PDF + extracted fields + discrepancy cards.  
10. **Audit Service** — who saw what, model IDs, rule pack versions, decision outcomes.  
11. **Integration Adapter** — webhooks to Finacle/trade portals (read LC, write case status) without owning payment.

### 17.2 Data model (simplified)

- `TradeCase(id, bank_tenant, domain, status, sla_due_at)`  
- `Party`, `LcInstrument(fields_45a_46a_47a, amount, currency, dates)`  
- `Document(id, type, storage_uri, sha256, ocr_status)`  
- `ExtractedField(doc_id, key, value, conf, bbox)`  
- `CheckResult(rule_id|model_id, severity, status, evidence_spans)`  
- `Discrepancy(code, description, human_decision, waiver_ref)`  
- `ReviewTask(maker, checker, state)`  
- `AuditEvent(...)`

### 17.3 Security & compliance architecture

- TLS 1.2+, encryption at rest (CMK), India region preference.  
- Secrets in vault; Groq API keys per tenant with rotation.  
- PII minimization; redact before any non-approved subprocessors.  
- Immutable audit (append-only table + object-lock).  
- Penetration test + SOC2-oriented controls roadmap for bank RFPs.

---

## 18. Development Plan

### Phase 0 — Discovery (3–5 weeks)

- Time-motion at 1 bank ops desk + 1 corporate exporter.  
- Collect **anonymized** sample packs (10–30) across 3 domains.  
- Confirm CBS integration constraints and Groq data egress approval.  
- Freeze MVP discrepancy catalog (top 30 codes).

**Exit:** validated baselines replace interview hypotheses for ROI.

### Phase 1 — MVP (8–12 weeks)

**In scope:**

- Upload pack + LC terms.  
- Classify + extract for: Invoice, Packing List, BL/eBL, CoO, Insurance, 1–2 cert types.  
- 25 deterministic rules.  
- Groq discrepancy narrative with citations.  
- Maker review UI (single reviewer OK for MVP; dual-control stub).  
- Audit log + exportable validation report.

**Out of scope:** blockchain network, payments, AIS oracles, full Finacle deep write-back.

**Stack (recommended):**

| Layer | Choice |
|-------|--------|
| API | FastAPI (Python) |
| Workers | Celery/RQ + Redis |
| DB | PostgreSQL |
| Files | S3-compatible (India) |
| OCR | Start: PyMuPDF text + Paddle/Tesseract; enterprise path: Textract/Document Intelligence |
| LLM | Groq (`openai/gpt-oss-120b` / `gpt-oss-20b` tiered) |
| Frontend | React + PDF.js |
| Auth | Keycloak / Entra ID OIDC |
| Observability | OpenTelemetry + structured logs |
| IaC | Terraform; Docker/K8s |

### Phase 2 — Bank pilot (8–12 weeks)

- Maker-checker dual control.  
- Domain packs v1 (Electronics + Engineering).  
- Registry lookup stubs (BIS number format validation; manual confirm).  
- SLA dashboard (banking-day calculator).  
- SOC questionnaire pack; DPAs.

### Phase 3 — Production hardening (12+ weeks)

- Oil pack + Q&Q math rules.  
- Inspector/registry APIs where legally available.  
- CBS adapters; SIEM; DR; load tests.  
- Optional hash anchoring (internal WORM first; Corda/Fabric later if bank demands).  
- Model eval harness + gold sets; drift monitoring.

### APIs (illustrative)

- `POST /v1/cases`  
- `POST /v1/cases/{id}/documents`  
- `POST /v1/cases/{id}/analyze`  
- `GET /v1/cases/{id}/discrepancies`  
- `POST /v1/discrepancies/{id}/decision`  
- `GET /v1/cases/{id}/audit`  
- `GET /v1/cases/{id}/report.pdf`

### Testing strategy

- Unit: rules pure functions.  
- Golden document packs with expected discrepancies.  
- Adversarial: forged stamps, field conflicts, OCR garbage.  
- Latency budgets: interactive review < 3s for cached; full pack analyze async.  
- Security: OWASP API; prompt-injection suites on document text.

### KPIs

| KPI | MVP target | Pilot target |
|-----|------------|--------------|
| Field extraction F1 (core fields) | ≥0.90 | ≥0.95 |
| Discrepancy recall (gold set) | ≥0.85 | ≥0.92 |
| Precision (avoid alert fatigue) | ≥0.75 | ≥0.85 |
| Median analyze time (30-page pack) | < 8 min | < 4 min |
| Human touch time reduction | measured | ≥40% |
| Autoclear rate (if enabled) | 0% (off) | policy-gated |

---

## 19. Groq Model Strategy

> Pricing snapshots from Groq docs / market trackers as of mid-2026 — **re-verify at build time**. Official catalog changes; abstraction is mandatory.

### 19.1 Task → model mapping

| Task | Suggested Groq model class | Why |
|------|----------------------------|-----|
| Doc type classification | Small/fast (`gpt-oss-20b` or equivalent instant tier) | Cheap, high QPS |
| Field extraction JSON | Mid/large instruct | Structure following |
| Cross-doc discrepancy reasoning | Larger reasoning (`gpt-oss-120b` class) | Better multi-doc logic |
| Discrepancy letter drafting | Mid | Style + citations |
| Vision (stamps/layout) | Vision-capable Groq model if in catalog; else external VLM fallback | Groq text-only gaps |
| Prompt-injection / safety filter | Prompt-guard class models | Bank safety |
| Audio (rare: call notes) | Whisper large-v3 / turbo | Optional |

### 19.2 Latency & throughput patterns

- Prefer **async pack pipelines**; stream per-document status to UI.  
- Groq advantage = high tokens/sec → good for interactive “explain this discrepancy.”  
- Batch non-urgent re-analysis via Batch API when available (**~50% cost** on some Groq offerings — confirm contractually).

### 19.3 Prompt / tooling patterns

1. **Tool-former checker:** model may only call `fetch_field`, `list_docs`, `run_rule`; final answer must be schema-validated JSON.  
2. **Citation mandatory:** `{doc_id, page, bbox/text_span, lc_clause}`.  
3. **Two-pass:** rules engine first; LLM only on residual ambiguities.  
4. **Self-consistency:** dual sample on high-severity cases; escalate discord to human.  
5. **Deterministic temperature** (0–0.2) for extraction; slightly higher for narrative.

### 19.4 Fallback

- Secondary provider (Azure OpenAI / Bedrock / local vLLM) behind same interface.  
- If Groq egress blocked: air-gapped OCR + rules-only mode with degraded LLM features.

### 19.5 Cost estimate (assumptions labeled)

**Assumptions (Researcher's inference):**

- Average pack: 40 pages → ~25k tokens OCR text retained after chunking strategy.  
- Per pack LLM usage: ~80k input + 8k output tokens across classification/extraction/reasoning calls (with caching/retrieval to avoid stuffing all pages every call).  
- Price anchor example: `openai/gpt-oss-120b` at **$0.15 / $0.60 per 1M** input/output (**Verified** on Groq docs page at time of research).  
- Mix: 70% calls on 20B-class, 30% on 120B-class.

**Rough math (120B-only upper bound):**  
`80k/1e6 * 0.15 + 8k/1e6 * 0.60 ≈ $0.012 + $0.0048 ≈ $0.017` per pack LLM — **plus** OCR vendor fees which usually dominate.

**At 10,000 packs/month:** Groq LLM might be **~$100–400** depending on mix/retries/context — **Assumption**. OCR could be **$500–5,000+**. **LLM is unlikely to be the cost bottleneck; OCR + humans are.**

---

## 20. Claim–Evidence–Assessment Table (interview figures)

| # | Claim | Evidence | Assessment | Implication |
|---|-------|----------|------------|-------------|
| 1 | ₹75–80k US→India LC cost one-way | Bank SoCs show % commissions + minima (HDFC/Axis/ICICI patterns); no flat ₹75k schedule found | **Interview-anecdotal**; figure **plausible as commission**, **not verified as doc-processing COGS** | Do not use as automation unit economics without decomposition |
| 2 | ICICI/HDFC/Axis digitized to 1–2 days; SBI/PNB lag | TradeChain, Contour, Trade Connect evidence for private banks; SBI in IBBIC; Finacle claims 8–9→2–3 days for network banks | **Partially verified** private-bank product leadership; **Unverified** absolute PSU lag / universal 1–2 day SLA | Sell AI overlay to both; avoid caricature |
| 3 | 500–700 papers/docs per trade | McKinsey ~50 sheets; user eng doc >20 docs | **Unverified as baseline**; likely **pages/docs conflation** or outlier packs | Size product for tens of docs / low hundreds pages |
| 4 | 5–7 days processing | UCP max **5 banking days per bank**; Contour cites 5–10 day presentation norms | **Mixed**: legal max **Verified**; 5–7 calendar as typical **Interview-anecdotal** | Separate UCP clock vs E2E calendar KPIs |
| 5 | 1 senior + ~6 juniors | No public org standard found | **Interview-anecdotal** / **Not available** | Treat as ROI sensitivity input |
| 6 | ~6 on buyer-bank final phase | Same | **Interview-anecdotal** | Validate in discovery |
| 7 | 2–3 hours active processing per person | Compatible with industry “hours of doc work” anecdotes; not India-bank measured | **Interview-anecdotal** | Time-motion study required |
| 8 | Finacle for document/banking processing | Finacle TF + maker-checker widely used; Infosys/EdgeVerve | **Verified** that Finacle is major stack; role includes more than routing today | Integrate; don’t assume zero AI already |
| 9 | Infosys / Fincore | No Infosys Fincore; Finacus FinCORE exists; Finacle is Infosys | **Verified naming confusion** | Correct all decks/docs |
| 10 | Digitization ≠ AI automation | Conceptual + platform capabilities | **Verified distinction** | Core product positioning |
| 11 | Oracle owns Finacle | EdgeVerve/Infosys own Finacle; Oracle Flexcube separate | **False** | Fix synopsis language |
| 12 | Finacle never validates content | Infosys markets AI classification/extraction + rules | **Outdated / overstated** | Compete on domain depth + UX + accuracy, not strawman |
| 13 | First presentation refusals 65–80% | ICC TAB-3 | **Industry estimates** | Strong problem validation |
| 14 | Blockchain required for MVP | User constraint = doc processing; hash audit optional | **Defer** | Phase 0–1 without DLT |
| 15 | Oil MT799 = PoF | SWIFT typology; user forensic doc | **Incorrect practice** | Educate workflows; detect scam patterns |

### Primary research questions — concise answers

1. **What costs ₹75–80k?** Likely customer-facing LC commission bundle — **Unverified** exact composition.  
2. **Who is more digitized?** Private banks more visible; PSUs not uniformly manual — **nuanced**.  
3. **500–700?** Not a safe baseline — **Unverified**.  
4. **5–7 days vs UCP?** UCP = ≤5 banking days/bank; 5–7 is broader ops narrative — **distinguish**.  
5. **Staffing/salaries?** Plausible bands; not publicly proven for LC cells — **Interview-anecdotal**.  
6. **Finacle?** Infosys/EdgeVerve trade + CBS — **Verified**.  
7. **Fincore?** Naming confusion — **Verified**.  
8. **Is AI opportunity real?** Yes for HITL document intelligence — **credible**.  
9. **Payment rail?** Out of scope.  
10. **Groq fit?** Strong for low-latency reasoning; pair with OCR/rules — **credible**.  
11–20. Remaining questions covered in §§3–15 and architecture sections (volume, HITL, ROI, risks, domain packs, phased build, KPIs, fallbacks, integrations, compliance).

---

## Appendix A — User document corpus summary

| File | Extract status | Use in this plan |
|------|----------------|------------------|
| Project Synopsis.pdf | Read | Problem, claims, scope |
| AI_Trade_Document_Verification_Synopsis(_Condensed).docx | Read | Same + modules |
| Synopsis.pdf | Read | Problem/blockchain clarification |
| Project Synopsis Format.docx.pdf | Read | Template only |
| Bank Ebl Flow (both dates) | Read | Phased LC/export workflow |
| Export Quotation Process | Read | Compressed phase map |
| Electronic Goods – Detailed | Read (partial+grep) | Electronics compliance pack |
| Verifying Oil Trade Documentation Phases | Read | Oil phases, fraud, UCP exam |
| Regional Engineering Export Compliance | Read (partial+grep) | Engineering phases, NABL/ARAI |

## Appendix B — Priority sources

- ICC UCP 600 Article 14 — https://library.iccwbo.org/content/tfb/RULES/tfb-ucp600-rules.htm  
- ICC discrepancy briefing coverage — Trade Finance Global on TAB-3 (65–80%)  
- McKinsey — “The multi-billion-dollar paper jam” (≈50 sheets / 30 stakeholders)  
- Infosys Finacle / EdgeVerve — finacle.com ownership & Trade Connect  
- ICICI TradeChain — icici.bank.in trade solutions  
- Citi India Contour press — cycle time claims  
- HDFC / Axis / ICICI published trade schedules of charges  
- Groq model docs — https://console.groq.com/docs/models  
- SBI Trade Finance Officer recruitment pay scale (MMGS-II)

## Appendix C — Recommended next actions for the engineering team

1. Replace synopsis quantitative claims with a **measurement plan** (2 weeks on desk).  
2. Build **gold set** of 30 packs (10/domain) with labeled discrepancies.  
3. Implement **rules-first** MVP; add Groq for residual reasoning only.  
4. Correct all external messaging: **Finacle ≠ Oracle**; **Fincore ≠ Infosys product**.  
5. Price ROI on **touch hours + first-pass yield**, not ₹75k fee capture.  
6. Keep blockchain as **Phase 3 optional**; ship HITL document AI first.

---

*End of document.*
