# Plan — besu-digital-asset-demo

> **Owner:** Howin Ho · **Created:** 2026-09-14 · **Status:** Locked (post grill-me)
> *"A permissioned digital asset, proven end to end — one validator, one compliant transfer at a time."*

---

## §1 Vision

**Long-term vision:** A personal reference implementation showing how a permissioned digital asset (ERC-3643) can be issued, onboarded, and transferred on a private Hyperledger Besu network — a template for exploring enterprise/regulated digital-asset patterns without the overhead of a public chain.

**Expansion axes:**
- **Width** — more compliance modules (country restriction, max-holder-count), more than one asset type
- **Depth** — real wallet integration (MetaMask), full per-investor OnchainID, multi-validator fault tolerance, production key management

**v1 wedge:** A single-validator, single-RPC-node Besu network running a trimmed ERC-3643 token (`DAT`), where an Admin onboards two fixed demo identities (Anson, Beatrice) and Anson pays Beatrice through a web dashboard. Nothing beyond this is in scope for v1.

---

## §2 Core Architecture Principles

| Hard-coded specific naming (avoid) | Generic abstraction (use) |
|---|---|
| `anson`, `beatrice` as literal identifiers baked into logic | `identity` — a generic registered-wallet record; Anson and Beatrice are just two seeded rows |
| `DAT` token contract treated as the only possible asset | `asset` (token contract type) — `DAT` is the first deployed instance, not a hardcoded assumption |
| Single validator assumed everywhere | `validator set` — config-driven list in `genesis.json`, currently length 1 |
| Admin as a single privileged wallet with no role model | `TrustedIssuer` / `TokenAgent` roles — currently both held by one wallet, but modeled as distinct roles in the contracts so they could be split later without a schema change |

---

## §3 Locked Decisions

| # | Decision | Lock |
|---|----------|------|
| D-01 | Asset model = **ERC-3643 (T-REX)** permissioned security token, not native transfer or plain ERC-20 | Locked |
| D-02 | Single **Admin wallet** plays both Token Agent and Trusted Issuer roles | Locked |
| D-03 | Trimmed T-REX core (`Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance`); per-investor OnchainID proxies skipped — wallet address used directly as identity key | Locked |
| D-04 | Consensus = **QBFT**, single validator | Locked |
| D-05 | **Zero-gas network** (`minGasPrice = 0`) | Locked |
| D-06 | Web frontend exists (not CLI-only) | Locked |
| D-07 | **Demo-mode identity switch** (dropdown for Anson/Beatrice); no real MetaMask integration in v1 | Locked |
| D-08 | **All-in-one dashboard** — Admin panel + Anson/Beatrice transfer UI in one web app | Locked |
| D-09 | **Backend API** (Node/Express + TS) holds all demo private keys server-side; never sent to the frontend | Locked |
| D-10 | Backend has a **DB** for transfer history / audit log | Locked |
| D-11 | DB = **SQLite** (file-based, no Postgres container) | Locked |
| D-12 | Project name = `besu-digital-asset-demo`; token = **`DAT`** (Digital Asset Token) | Locked |
| D-13 | Playwright E2E covers 3 flows: admin onboarding, happy-path transfer, compliance rejection | Locked |
| D-14 | **4-phase build plan**: ① Network ② Contracts ③ Backend API ④ Frontend + E2E, each with a hard exit gate | Locked |
| D-15 | Positioning = **personal learning PoC**; README states plainly that data is fictional and no real compliance framework (CASL/PIPEDA/GDPR/PCI) applies | Locked |
| D-16 | Solo repo — commits go directly to `main`; no CI workflow; local `typecheck`/`test` only | Locked |
| D-17 | Service topology = 4 containers (`besu-validator`, `besu-rpc`, `backend-api`, `frontend`); integration = sync REST only, no event broker; business model = N/A | Locked |
| D-18 | Architecture style = **Monolith** backend + SPA frontend + 2-node blockchain infra tier (see `architecture.md` §1) | Locked |
| D-19 | Identity/Auth model = **no production auth**; the "acting as" dropdown is the entire access model, explicitly disclaimed | Locked |
| D-20 | Transaction lifecycle scope = **single-step compliant transfer only** — no cancel, change, refund, or escrow in v1 | Locked |
| D-21 | Launch/distribution/acquisition/geography = **N/A** — solo local PoC, no staged rollout, no marketing, no launch region | Locked |
| D-22 | Data residency & retention = **N/A** — all data stays on the developer's machine (Docker volumes); no retention policy or privacy officer needed (no real PII exists) | Locked |
| D-23 | Confirm channel = **N/A** — no SMS/email; all feedback is synchronous in-UI | Locked |
| D-24 | Platform naming = `besu-digital-asset-demo`, English only, no localization, no domain registered | Locked |

---

## §4 Phase Plan

### Phase 1 — Network

**Goal:** A working QBFT Besu network (1 validator + 1 RPC node), zero-gas, reachable via JSON-RPC.

**Scope:**
- `genesis.json` with QBFT config and `minGasPrice = 0`
- `docker-compose.yml` defining `besu-validator` and `besu-rpc`, statically peered
- Out of scope: contracts, backend, frontend

#### M1.1 — Genesis & QBFT Config (Day 1)

**Services in scope:** validator key + genesis file generation (no containers running yet)
**Out:** `besu-rpc`, `backend-api`, `frontend`
**Surface for demo:** inspecting the generated `genesis.json` and key files on disk
**Vertical slice proven:** a valid QBFT genesis exists that a Besu node can boot from

**Steps:**

1. Generate a validator key pair and QBFT genesis using Besu's `operator generate-blockchain-config` CLI subcommand.
   > **Gate ✓** — `network-config/genesis.json` and validator key files exist; `genesis.json` contains a `qbft` config block with the validator's address in `extraData`

2. Write the `besu-validator` service definition in `docker-compose.yml`, mounting the generated genesis and key.
   > **Gate ✓** — `docker compose config` exits 0 (valid compose file, no schema errors)

**Exit gate:**
- [ ] `genesis.json` exists with a `qbft` config block
- [ ] `docker compose config` validates without error

#### M1.2 — Compose Services & Peering (Day 1–2)

**Services in scope:** `besu-validator`, `besu-rpc`
**Out:** contracts, backend, frontend
**Surface for demo:** `curl -s -X POST http://localhost:8545 -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
**Vertical slice proven:** a live, block-producing permissioned chain exists and is externally queryable

**Steps:**

1. Add the `besu-rpc` service to `docker-compose.yml` as a non-validating full node with `--rpc-http-enabled`, statically peered to `besu-validator` (`static-nodes.json`).
   > **Gate ✓** — `docker compose up -d` starts both containers, `docker compose ps` shows both `running` with no restart loop

2. Confirm peering and block production.
   > **Gate ✓** — `docker compose logs besu-rpc` shows peer count ≥ 1; two `eth_blockNumber` calls 5s apart return an increasing block number

3. Confirm zero-gas configuration.
   > **Gate ✓** — `eth_gasPrice` returns `0x0`

**Exit gate (= Phase 1 exit gate):**
- [x] Both containers healthy and peered
- [x] `eth_blockNumber` increases over time (QBFT producing blocks)
- [x] `eth_gasPrice` returns `0x0`

**Anti-gate:** If `besu-rpc` cannot peer with `besu-validator` after fixing `static-nodes.json`/networking, do not proceed to Phase 2 — the whole stack depends on a live chain.

**Rationale for this slicing:** Phases 1–4 are ordered by technical layer (network → contracts → backend → frontend), not by vertical user-facing feature — this is a horizontal-layer decomposition, not a classic vertical slice. That is the correct call here, not a shortcut: each layer is a hard, one-directional dependency for the next (contracts can't be tested without a live chain; the backend can't be tested without deployed contract addresses; the frontend can't be tested without a working API). There are no external stakeholders needing a partial vertical demo each week, and a single developer benefits more from finishing and gate-checking one layer completely before touching the next than from threading thin vertical slices through four layers that don't exist yet.

---

### Phase 2 — Contracts

**Goal:** The trimmed T-REX suite is deployed on the Phase 1 network and actually enforces compliance.

**Scope:**
- Solidity contracts (or imported trimmed T-REX reference contracts)
- Hardhat deploy script
- Admin CLI scripts (`registerIdentity.ts`, `issueClaim.ts`, `mintToken.ts`, `transfer.ts`)
- Hardhat tests proving compliance enforcement
- Out of scope: backend API, frontend

**Steps:**

1. Compile the trimmed T-REX contracts (`Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance`).
   > **Gate ✓** — `npx hardhat compile` exits 0

2. Write the Hardhat deploy script wiring all 6 contracts together against the Phase 1 network (`--network besu`).
   > **Gate ✓** — deploy script produces `deployed-addresses.json` with 6 non-zero contract addresses

3. Write Admin CLI scripts.
   > **Gate ✓** — `npx hardhat run scripts/registerIdentity.ts --network besu` followed by a balance/verification check script confirms the target address is `registered` but not yet `verified`; running `issueClaim.ts` afterward flips it to `verified`

4. Write Hardhat tests proving the compliance guarantee.
   > **Gate ✓** — `npx hardhat test` is green, including a test asserting `transfer()` reverts for an unverified recipient and succeeds for a verified one

**Exit gate:**
- [x] `npx hardhat test` green, including the compliance-rejection test
- [x] Admin CLI scripts run register → claim → mint end to end against the live Phase 1 network
- [x] `deployed-addresses.json` available for Phase 3 to consume

**Anti-gate:** Do not proceed to Phase 3 if the compliance-rejection test does not actually revert — that would mean D-01's core guarantee isn't real.

---

### Phase 3 — Backend API

**Goal:** Express backend exposing all 6 REST endpoints, backed by `ChainService`/`ComplianceAdminService`/`TransferService`/`AuditLogRepository`, with all keys held server-side.

**Scope:** `backend-api` container, SQLite schema, service-layer unit tests
**Out of scope:** frontend

**Steps:**

1. Implement `ChainService` (one signer per demo identity, `signAndSend`).
   > **Gate ✓** — unit test confirms each of Admin/Anson/Beatrice resolves to its expected address from `.env.local`

2. Implement `ComplianceAdminService` and `TransferService` against the Phase 2 contracts.
   > **Gate ✓** — `npm run test -- --testPathPattern=services` green (mocked `ChainService`), covering PRD US-003–US-007

3. Implement `AuditLogRepository` and the SQLite `transfers` schema.
   > **Gate ✓** — migration creates `transfers.db`; unit test inserts and reads back a row

4. Implement the 6 Express routes (US-008).
   > **Gate ✓** — `curl -X POST localhost:4000/admin/register-identity -d '{"who":"anson"}'` against the running Phase 1+2+3 stack returns `200`, and the identity shows verified after the full onboarding sequence

5. Add `backend-api` to `docker-compose.yml`.
   > **Gate ✓** — `docker compose up -d backend-api` starts healthy and reaches `besu-rpc` over the internal Docker network

**Exit gate:**
- [x] All 6 endpoints manually verified via `curl` against the full Phase 1+2+3 stack
- [x] Service-layer unit tests green
- [x] Spot-check confirms no private key ever appears in a response body

**Anti-gate:** Do not proceed to Phase 4 if any endpoint returns a private key or raw signer data — this breaks FR-8 outright.

---

### Phase 4 — Frontend + E2E

**Goal:** React dashboard wired to the backend, with all 3 Playwright specs green against the full stack.

**Scope:** `frontend` container, `AdminPanel`, `TransferDashboard`, `ApiClient`, Playwright specs
**Out of scope:** anything listed in §10 Out of Scope

**Steps:**

1. Build `ApiClient` + `AdminPanel` (register/claim/mint UI).
   > **Gate ✓** — `npx playwright test tests/onboarding.spec.ts` passes

2. Build `TransferDashboard` (identity switch, balance display, send form, history table).
   > **Gate ✓** — `npx playwright test tests/happy-path-transfer.spec.ts` passes

3. Build the compliance-rejection UI error path.
   > **Gate ✓** — `npx playwright test tests/compliance-rejection.spec.ts` passes

4. Add `frontend` to `docker-compose.yml`; validate a fresh full-stack run.
   > **Gate ✓** — from `docker compose down -v && docker compose up -d`, then `npm run seed`, all 3 Playwright specs pass against the freshly started stack

**Exit gate:**
- [x] `npx playwright test` — 3/3 specs pass (onboarding, happy-path-transfer, compliance-rejection)
- [x] README "Getting Started" followed literally from a clean checkout produces a working demo (PD-4.3)

**Anti-gate:** Do not consider the project done if any Playwright spec is flaky (passes intermittently) — fix the root cause before closing Phase 4.

---

## §5 Architecture Snapshot

**Topology:** 4-container Docker Compose stack — `besu-validator` + `besu-rpc` (QBFT, zero-gas) → T-REX contracts → `backend-api` (Express monolith, holds keys) → `frontend` (React SPA). See `architecture.md` for full detail.

| Phase gate | Architecture change |
|---|---|
| Phase 1 → 2 | Deployed contract addresses become the coupling artifact the backend depends on |
| Phase 2 → 3 | `backend-api` introduces the only server-side secret in the system (demo private keys in `.env.local`) |
| Phase 3 → 4 | `frontend` becomes the only browser-facing surface (still localhost-only); no further architecture changes planned — see `architecture.md` §2 MVP simplification block for what's explicitly deferred |

---

## §6 KPI Summary

**North Star:** A real, verifiable Anson → Beatrice transfer completes end to end with the ERC-3643 compliance check actually enforced (proven, not just asserted).

| Phase | Gating metric | Target |
|---|---|---|
| Phase 1 | Block production | `eth_blockNumber` increases within 30s of `docker compose up` |
| Phase 2 | Compliance enforcement | Compliance-rejection Hardhat test passes 100% of runs |
| Phase 3 | API correctness | 6/6 endpoints manually verified; 0 key leaks in any response |
| Phase 4 | E2E proof | 3/3 Playwright specs green across 3 consecutive local runs (non-flaky) |

**Anti-metric kill switch:** If the compliance-rejection test (Phase 2) cannot be made to revert correctly after roughly a day of debugging, stop and re-verify the trimmed T-REX wiring before continuing — this is the core value proof of the entire project. Do not proceed to Phase 3 on a broken compliance guarantee.

---

## §7 Risk Register

| # | Risk | L | I | Phase | Mitigation |
|---|------|---|---|-------|------------|
| R1 | Single validator — chain halts entirely if the `besu-validator` container dies | Med | High | 1–4 | Accepted for PoC scope (D-04); restart container to recover; multi-validator set deferred (FR-16) |
| R2 | Trimmed T-REX (no per-investor OnchainID) is not audit-grade compliance tooling | Low | Low | 2 | Accepted by design (D-03); FR-13 explicitly deferred; disclaimed in README |
| R3 | Demo private keys leak via unhandled error stack traces or logs | Low | Med | 3 | FR-8; sanitized error handling in `ChainService`; `.env.local` gitignored |
| R4 | SQLite audit-log write fails after a confirmed on-chain transfer, creating a gap between chain state and local log | Low | Low | 3–4 | Chain remains source of truth for balances (documented in `architecture.md` §3); gap can be backfilled manually |
| R5 | No authentication on backend API routes — any local caller can act as Admin or trigger transfers | Med (if exposed) | High (if exposed) | 3–4 | Accepted only because bound to localhost/internal Docker network (`architecture.md` §10); must add real auth before any non-local deployment |
| R6 | Solo-developer bandwidth — one person builds, tests, and debugs every layer | Med | Med | all | Strict 4-phase sequencing with hard exit gates (D-14) prevents context-thrashing across layers |
| R7 | Besu / Hardhat / ethers.js version incompatibilities (fast-moving tooling) | Med | Med | 1–2 | Pin exact versions in `package.json` and Docker image tags at Phase 1 start (see `deliverables.md`) |
| R8 | Supply-side vendor adoption | — | — | — | N/A — no vendors or marketplace exist in this project (D-21) |
| R9 | CASL violation (unsolicited messaging) | — | — | — | N/A — no marketing or messaging sent (D-23) |
| R10 | Distribution host policy change | — | — | — | N/A — not distributed via any platform (D-21) |
| R11 | Unit economics (CAC > LTV) | — | — | — | N/A — no business model (D-17) |
| R12 | Bilingual UI delay | — | — | — | N/A — English-only demo, no localization requirement (D-24) |
| R13 | Third-party cost spikes (SMS/email/infra) | — | — | — | N/A — no third-party services used (D-15, D-23) |

---

## §8 Compliance Notes

- **CASL:** Not applicable — no marketing or transactional messaging is sent by this system; there is no consent/opt-in flow to log.
- **PIPEDA / provincial privacy (Canada):** Not applicable — no real personal information is collected, stored, or processed. Anson and Beatrice are fictional demo identities; nothing in the system constitutes personal information under PIPEDA. No data residency requirement exists because all data stays on the developer's own machine (Docker volumes), and no designated privacy officer is required.
- **GDPR / HIPAA / PCI / other regulations:** Not applicable — no EU data subjects, no health data, no payment card data are processed anywhere in this system.
- This positioning is explicit and intentional (D-15) and must be re-evaluated from scratch — via a new `/grill-me` pass — before any of these patterns are reused with real user data.

---

## §9 Open Questions

| # | Question | Owner | Deadline | Status |
|---|----------|-------|----------|--------|
| — | None outstanding | — | — | All decisions resolved in the `/grill-me` interview (§3) |

---

## §10 Out of Scope (MVP)

- Real MetaMask wallet connection (FR-14)
- Per-investor OnchainID proxy contracts / full T-REX fidelity (FR-13)
- Production-grade key management (HSM, KMS, hardware wallet)
- Real KYC/AML integration — claims are Admin-self-issued for demo purposes only
- Public or mainnet deployment
- CI/CD pipeline (D-16)
- Multi-validator QBFT set / consensus fault tolerance (FR-16)
- Additional compliance modules (country restriction, max-holder-count) (FR-15)
- Any transaction type beyond single-step transfer — no cancel, change, refund, or escrow (D-20)
- Multiple asset/token types — `DAT` only
- Mobile app
- Marketplace, vendor, or multi-tenant concepts of any kind
- Business model, pricing, or paywall of any kind (D-17)
- Any geographic launch staging or acquisition strategy (D-21)
- SMS/email/any external notification channel (D-23)

---

## §11 Related Artifacts

- [docs/prd.md](prd.md) — product requirements, user stories, functional requirements
- [docs/architecture.md](architecture.md) — service architecture, integration patterns, security model
- [docs/use-cases.md](use-cases.md) — end-to-end flows with sequence diagrams
- [docs/deliverables.md](deliverables.md) — phase-by-phase deliverables and "how to try it" guides
- [docs/chain-gateway.md](chain-gateway.md) — optional post-MVP addition (not a phase, not gated by any decision above): an alternate chain transport, added after this plan's phases were already complete
