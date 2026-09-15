# PRD: besu-digital-asset-demo

## 1. Introduction/Overview

A personal learning proof-of-concept that demonstrates a **permissioned digital asset transfer** on a private Hyperledger Besu network. The system stands up a single-validator, single-RPC-node Besu network (QBFT, zero gas), deploys a trimmed ERC-3643 (T-REX) permissioned token contract suite, and provides a web dashboard where an **Admin** onboards two demo identities (**Anson**, **Beatrice**) and Anson pays Beatrice using the token (`DAT` — Digital Asset Token). The project exists to build hands-on understanding of Besu network operation, ERC-3643 compliance-gated transfers, and the layered architecture (contracts → chain → backend → frontend) needed to expose a blockchain asset to end users.

This is not a production system. There are no real users, no real KYC data, and no monetization.

## 2. Goals

- Stand up a working QBFT Besu network (1 validator + 1 RPC node) via Docker Compose, with zero transaction fees.
- Deploy a trimmed ERC-3643 contract suite that enforces transfer restrictions based on on-chain identity verification.
- Let an Admin onboard two identities (register + issue claim) and mint `DAT` to one of them.
- Let a verified identity transfer `DAT` to another verified identity, and see the transfer rejected when the recipient is not verified.
- Persist every successful transfer to a local audit log, visible in the dashboard.
- Cover the three critical flows (onboarding, happy-path transfer, compliance rejection) with Playwright E2E tests.

## 3. Business Model

N/A — personal learning PoC. No pricing, no paywall, no user accounts beyond the three fixed demo identities.

## 4. Module Sketch (confirmed)

**NEW — deep modules:**
- **T-REX contract suite** (`Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance`) — encapsulates all compliance/transfer-restriction logic behind the standard ERC-3643 interface (`transfer`, `registerIdentity`, `addClaim`, `mint`).
- **ChainService** (backend) — wraps ethers.js; holds one signer per demo identity (Admin/Anson/Beatrice); exposes `signAndSend(txRequest, asIdentity)`. Encapsulates key management, nonce handling, and RPC connection.
- **ComplianceAdminService** (backend) — exposes `registerIdentity(address)`, `issueClaim(address)`, `mintToken(address, amount)`. Encapsulates the onboarding orchestration sequence and calls `ChainService`.
- **TransferService** (backend) — exposes `transfer(fromIdentity, toAddress, amount)`. Encapsulates the compliance-aware transfer call and audit log write.
- **AuditLogRepository** (backend, SQLite) — exposes `recordTransfer(entry)`, `listTransfers()`. Encapsulates persistence.

**NEW — shallow modules (thin adapters, no business logic):**
- Express API routes (`POST /admin/register-identity`, `POST /admin/issue-claim`, `POST /admin/mint`, `POST /transfer`, `GET /balance/:who`, `GET /transfers`)
- Frontend `AdminPanel` component
- Frontend `TransferDashboard` component (identity switcher + send + balance)
- Frontend `ApiClient` (thin `fetch` wrapper)

## 5. User Stories

### US-001: Bring up the Besu network
**Description:** As the developer, I want `docker compose up` to start a working QBFT network so I have a chain to deploy contracts to.
**Acceptance Criteria:**
- [ ] `besu-validator` and `besu-rpc` containers start and stay healthy
- [ ] `besu-rpc` peers with `besu-validator` (peer count ≥ 1)
- [ ] `curl eth_blockNumber` against `besu-rpc` returns an increasing block number
- [ ] Genesis configures `minGasPrice = 0`

### US-002: Deploy the trimmed T-REX contract suite
**Description:** As the developer, I want the six core T-REX contracts deployed and wired together so the token enforces permissioned transfers.
**Acceptance Criteria:**
- [ ] `Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance` all deploy successfully via a Hardhat script
- [ ] Contract addresses are written to a shared config file the backend can read
- [ ] Token name/symbol are set to "Digital Asset Token" / `DAT`
- [ ] Typecheck/compile passes

### US-003: Admin registers an identity
**Description:** As the Admin, I want to register a wallet address as a verified identity so it becomes eligible to hold and receive `DAT`.
**Acceptance Criteria:**
- [ ] `ComplianceAdminService.registerIdentity(address)` calls `IdentityRegistry` and the address is marked verified
- [ ] Calling it twice for the same address does not throw / is idempotent
- [ ] Unit test covers the service in isolation (mocked `ChainService`)

### US-004: Admin issues a KYC claim
**Description:** As the Admin (acting as Trusted Issuer), I want to issue a claim to a registered identity so it passes the compliance check.
**Acceptance Criteria:**
- [ ] `ComplianceAdminService.issueClaim(address)` results in the address holding a valid claim recognized by `ModularCompliance`
- [ ] Attempting to issue a claim to an unregistered address fails with a clear error
- [ ] Unit test covers the service in isolation

### US-005: Admin mints DAT
**Description:** As the Admin, I want to mint `DAT` to a verified identity so there is a starting balance to transfer from.
**Acceptance Criteria:**
- [ ] `ComplianceAdminService.mintToken(address, amount)` increases the address's `DAT` balance
- [ ] Minting to an unverified address is rejected by the contract
- [ ] Unit test covers the service in isolation

### US-006: Verified identity transfers DAT to another verified identity
**Description:** As Anson, I want to send `DAT` to Beatrice so the payment use case is demonstrated end to end.
**Acceptance Criteria:**
- [ ] `TransferService.transfer('anson', beatriceAddress, amount)` succeeds when both are verified
- [ ] Anson's balance decreases and Beatrice's balance increases by `amount`
- [ ] A row is written to the SQLite audit log with `from`, `to`, `amount`, `txHash`, `timestamp`
- [ ] Unit test covers the service in isolation

### US-007: Transfer to an unverified address is rejected
**Description:** As Anson, if I try to send `DAT` to an address that was never onboarded, the system must refuse the transfer so the compliance guarantee is visible.
**Acceptance Criteria:**
- [ ] `TransferService.transfer` surfaces a clear, typed error when the on-chain call reverts due to compliance failure
- [ ] No audit log row is written for a failed transfer
- [ ] Unit test covers this rejection path

### US-008: Backend API exposes admin and transfer endpoints
**Description:** As the frontend, I need REST endpoints to trigger admin actions and transfers without holding any private keys myself.
**Acceptance Criteria:**
- [ ] `POST /admin/register-identity`, `POST /admin/issue-claim`, `POST /admin/mint`, `POST /transfer` all call their respective services and return JSON success/error
- [ ] `GET /balance/:who` returns the live on-chain `DAT` balance for `anson` / `beatrice`
- [ ] `GET /transfers` returns the audit log from SQLite
- [ ] Private keys are read only from server-side config (`.env.local`), never returned in any response
- [ ] Typecheck passes

### US-009: Admin panel in the dashboard
**Description:** As the Admin, I want a UI to register, issue claims, and mint without using the CLI.
**Acceptance Criteria:**
- [ ] Admin panel has buttons/forms for register / issue claim / mint against Anson and Beatrice
- [ ] UI shows success/error feedback per action
- [ ] Verify in browser using dev-browser skill

### US-010: Transfer dashboard with identity switch
**Description:** As Anson or Beatrice, I want to pick "who I am" and send `DAT` to the other person, and see my balance.
**Acceptance Criteria:**
- [ ] Dropdown to switch between "Anson" and "Beatrice"
- [ ] Current identity's live balance is displayed
- [ ] "Send" form transfers to the other identity and refreshes both balances on success
- [ ] Failed/rejected transfer shows a clear error message in the UI
- [ ] Verify in browser using dev-browser skill

### US-011: Transfer history view
**Description:** As any user of the dashboard, I want to see past transfers so I can confirm the demo worked.
**Acceptance Criteria:**
- [ ] Table listing audit log entries (from, to, amount, timestamp, tx hash link)
- [ ] Updates after a new transfer without a full page reload
- [ ] Verify in browser using dev-browser skill

### US-012: E2E coverage for the three critical flows
**Description:** As the developer, I want Playwright tests so regressions in the core flows are caught automatically.
**Acceptance Criteria:**
- [ ] `onboarding.spec` — Admin registers both identities, issues claims, mints to Anson, asserts both show verified
- [ ] `happy-path-transfer.spec` — Anson sends 100 `DAT` to Beatrice, asserts balances and audit log update
- [ ] `compliance-rejection.spec` — Anson attempts transfer to an unregistered address, asserts revert/error is surfaced in the UI
- [ ] All three specs pass locally against the Docker Compose stack

## 6. Functional Requirements

**MVP (must ship for the demo to be considered working):**
- FR-1: The system must run a QBFT Besu network with exactly one validator and one RPC node via Docker Compose.
- FR-2: The network must be configured for zero gas fees (`minGasPrice = 0`).
- FR-3: The system must deploy the six trimmed T-REX contracts and wire them together (Identity Registry ↔ Compliance ↔ Token).
- FR-4: The Admin must be able to register an identity, issue a KYC claim, and mint `DAT` — via CLI script and via the Admin panel UI.
- FR-5: A verified identity must be able to transfer `DAT` to another verified identity.
- FR-6: The contract must revert a transfer where the sender or recipient is not verified, and the backend/UI must surface this as a clear error, not a crash.
- FR-7: Every successful transfer must be written to a SQLite audit log (from, to, amount, txHash, timestamp).
- FR-8: The backend must never expose a private key in any API response or log line.
- FR-9: The frontend must provide a "currently acting as" selector (Anson / Beatrice) instead of a wallet connection.
- FR-10: Three Playwright specs (onboarding, happy-path transfer, compliance rejection) must pass against the full Docker Compose stack.

**Post-MVP (valuable, not blocking the demo):**
- FR-11: Transfer history table with client-side filtering (by identity, by date).
- FR-12: Structured logging (pino) across the backend for easier debugging.

**Future (explicitly deferred):**
- FR-13: Per-investor OnchainID proxy contracts (full T-REX fidelity).
- FR-14: Real MetaMask wallet connection instead of demo-mode identity switching.
- FR-15: Additional compliance modules (e.g. max-holder-count, country restriction).
- FR-16: Multi-validator QBFT network for fault tolerance.

## 7. Non-Goals (Out of Scope)

- No real user accounts, authentication, or multi-tenant support.
- No production-grade key management (HSM, KMS, hardware wallet) — demo keys in server config only.
- No real KYC/AML integration — claims are self-issued by the Admin for demo purposes.
- No public/mainnet deployment.
- No CI/CD pipeline (per D-16 — solo repo, local verification only).
- No support for assets/tokens other than `DAT`.
- No mobile app or MetaMask wallet integration in v1.

## 8. Design Considerations

- Dashboard has two clearly separated areas: **Admin panel** (register/claim/mint) and **Transfer panel** (identity switch, send, balance, history).
- Reuse a single `ApiClient` module in the frontend for all backend calls — no ad hoc `fetch` calls scattered across components.
- Error states from contract reverts must be translated into human-readable messages in the UI (not raw RPC error JSON).

## 9. Technical Considerations

- Backend: Node.js 20, TypeScript (strict), Express, ethers.js — matches personal stack defaults.
- Contracts: Solidity, Hardhat for compile/deploy/test.
- Frontend: React (Vite), talks to backend only — never talks to Besu RPC directly.
- DB: SQLite (file-based), no separate DB container (D-11).
- No event broker — single backend service, synchronous REST only (D-17).
- Docker Compose defines exactly 4 services: `besu-validator`, `besu-rpc`, `backend-api`, `frontend`.

**Non-Functional Requirements:**

| NFR | MVP target | How the architecture supports it | Tradeoff / phase gate |
|---|---|---|---|
| Availability | Available during local demo sessions only; no uptime SLA | Docker Compose local stack | Single validator = no fault tolerance; acceptable for PoC, documented as a known limitation |
| Latency | Transfer confirmed end-to-end (UI click → balance update) in < 10s | QBFT ~2-5s block time, backend polls for receipt | No latency budget for network partitions/restarts |
| Consistency | Strong consistency for on-chain balances (chain is source of truth); audit log may lag by a few seconds | Balance always read live from chain, not cached | Audit log write is best-effort after tx confirmation, not atomic with the transfer |
| Security | Demo keys isolated to backend server-side config, never sent to browser | Backend-only signing (D-09), `.env.local` gitignored | Not a production key-management model; explicitly disclaimed in README |
| Observability | Console/structured logs sufficient to debug a failed transfer | pino logging in backend (post-MVP) | No distributed tracing — single backend service doesn't need it |
| Cost | $0 infra cost | Fully local Docker Compose, no cloud resources | N/A |

## 10. Success Metrics

- Network liveness: 0 (not built) → `besu-rpc` reports an increasing block number within 30s of `docker compose up` by end of Phase 1.
- Onboarding flow: 0 → Admin can register + claim + mint both identities in under 2 minutes via UI by end of Phase 4.
- Happy-path transfer: 0 → Anson-to-Beatrice transfer completes and reflects in both balances and the audit log within 10s by end of Phase 4.
- Compliance enforcement: 0 → transfer to an unverified address is rejected with a clear UI error in 100% of test runs by end of Phase 4.
- E2E coverage: 0 → 3/3 Playwright specs green by end of Phase 4.

## 11. Open Questions

None outstanding — all product/scope decisions were resolved in the `/grill-me` interview (see `docs/plan.md` decision log D-01 through D-17).

## 12. Risks

Cross-referenced with the risk register in `docs/plan.md`.

| Risk ID | Description | Mitigated by |
|---------|-------------|--------------|
| R1 | Single validator halts the whole chain if its container dies | Documented limitation (README, PRD NFR table); not mitigated — accepted for PoC scope |
| R2 | Trimmed T-REX suite is not audit-grade; skipping OnchainID may hide real-world edge cases | FR-13 explicitly deferred; README compliance disclaimer |
| R3 | Demo private keys in server config could leak via logs or error messages | FR-8 (never expose keys in responses/logs), `.env.local` gitignored |
| R4 | Compliance-check revert reasons from Solidity are hard to parse into a friendly UI message | FR-6, US-007 acceptance criteria require a typed error surfaced clearly, covered by `compliance-rejection.spec` |

## 13. Phase Deliverables

#### Phase 1 — Network

| # | Deliverable | Notes |
|---|-------------|-------|
| PD-1.1 | `docker-compose.yml` with `besu-validator` + `besu-rpc` services | QBFT, zero-gas genesis |
| PD-1.2 | `genesis.json` with QBFT config and `minGasPrice = 0` | |
| PD-1.3 | Verified peer connectivity + `eth_blockNumber` increasing | Manual `curl` check documented in README |

#### Phase 2 — Contracts

| # | Deliverable | Notes |
|---|-------------|-------|
| PD-2.1 | Six trimmed T-REX contracts compiled and deployed via Hardhat script | |
| PD-2.2 | Admin CLI scripts: `registerIdentity.ts`, `issueClaim.ts`, `mintToken.ts`, `transfer.ts` | |
| PD-2.3 | Hardhat tests proving compliance check blocks unverified transfers | |

#### Phase 3 — Backend API

| # | Deliverable | Notes |
|---|-------------|-------|
| PD-3.1 | Express app with all 6 endpoints (US-008) | |
| PD-3.2 | `ChainService`, `ComplianceAdminService`, `TransferService`, `AuditLogRepository` implemented with unit tests | |
| PD-3.3 | SQLite schema + migration for `transfers` table | |

#### Phase 4 — Frontend + E2E

| # | Deliverable | Notes |
|---|-------------|-------|
| PD-4.1 | React dashboard: Admin panel + Transfer panel + history table | |
| PD-4.2 | 3 Playwright specs green (onboarding, happy-path, compliance-rejection) | |
| PD-4.3 | README "Getting Started" verified end to end by a fresh `docker compose up` | |
