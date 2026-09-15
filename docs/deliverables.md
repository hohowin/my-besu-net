# Deliverables Guide - besu-digital-asset-demo

> Owner: Howin Ho
> Created: 2026-09-14
> Status: Draft

Companion docs: [docs/plan.md](plan.md) - [docs/prd.md](prd.md) - [docs/architecture.md](architecture.md) - [docs/use-cases.md](use-cases.md)

This document is the single reference for what is deliverable and verifiable at the end of each project phase, and how to try each deliverable from a cold start.

---

## §1 Overview Table

| DL-ID | Phase | Milestone | Type | Deliverable | Status |
|---|---|---|---|---|---|
| DL-1.1 | Phase 1 - Network | M1.1 | infra | QBFT genesis config | Done |
| DL-1.2 | Phase 1 - Network | M1.2 | infra | Peered validator + RPC network | Done |
| DL-2.1 | Phase 2 - Contracts | N/A | infra | Deployed trimmed T-REX suite | Done |
| DL-2.2 | Phase 2 - Contracts | N/A | api | Admin CLI scripts | Done |
| DL-2.3 | Phase 2 - Contracts | N/A | test | Hardhat compliance test suite | Done |
| DL-3.1 | Phase 3 - Backend API | N/A | api | 6 REST endpoints | Done |
| DL-3.2 | Phase 3 - Backend API | N/A | test | Service-layer unit tests | Done |
| DL-3.3 | Phase 3 - Backend API | N/A | infra | SQLite audit log | Done |
| DL-3.4 | Phase 3 - Backend API | N/A | infra | `backend-api` container wired into compose | Done |
| DL-4.1 | Phase 4 - Frontend + E2E | N/A | ui | Admin panel | Planned |
| DL-4.2 | Phase 4 - Frontend + E2E | N/A | feature | Transfer dashboard | Planned |
| DL-4.3 | Phase 4 - Frontend + E2E | N/A | test | 3 Playwright E2E specs | Planned |
| DL-4.4 | Phase 4 - Frontend + E2E | N/A | doc | README verified from a clean checkout | Planned |

---

## Phase 1 - Network

**Goal**: A developer can bring up a live, permissioned, zero-gas Besu network with one command and query it over JSON-RPC.

**Prerequisites:**
```
Checklist:
- [ ] Docker + Docker Compose installed
- [ ] Repo cloned, working directory is repo root
- [ ] No prior phase (this is Phase 1)
```

---

##### DL-1.1 - QBFT genesis config

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 1 - Network |
| **Milestone** | M1.1 |
| **Traces to** | PRD US-001, plan.md M1.1 |
| **Demo surface** | Files on disk under `network-config/` |

**What it is**: The generated QBFT genesis file and validator key that every other deliverable in this project depends on.

**How to try it**:
```
1. Run: docker run --rm --user 1000:1000 -v "$(pwd)/network-config:/data" hyperledger/besu:latest operator generate-blockchain-config --config-file=/data/qbft-config.json --to=/data/out --private-key-file-name=key
   Note: --user 1000:1000 is required - the official Besu image's entrypoint runs a root-only
   permission-fixing pre-pass that creates the --to directory as a side effect, which then makes
   the real command fail with "Output directory already exists". Running as a non-root user skips
   that pre-pass entirely.
2. Inspect network-config/out/genesis.json
3. Confirm it contains a "qbft" block under "config" and the validator address appears in "extraData"
4. Copy genesis.json to network-config/genesis.json and the generated key file to network-config/validator-key/key (this is the layout docker-compose.yml expects)
```

**Verification checklist**:
- [ ] `network-config/out/genesis.json` exists
- [ ] `genesis.json` contains a `qbft` config block
- [ ] `docker compose config` exits 0 once `docker-compose.yml` references the genesis file

**Known limitations at this phase**: No container is running yet - this is config generation only. Resolved by DL-1.2.

---

##### DL-1.2 - Peered validator + RPC network

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 1 - Network |
| **Milestone** | M1.2 |
| **Traces to** | PRD US-001, plan.md M1.2 |
| **Demo surface** | `curl` against `http://localhost:8545` |

**What it is**: The two-container Besu network - `besu-validator` producing blocks, `besu-rpc` exposing JSON-RPC - proving the network is actually live, not just configured.

**How to try it**:
```
1. Run: docker compose up -d besu-validator besu-rpc
2. Run: docker compose ps
   Expect both containers listed as "running", no restart loops
3. Run: curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
4. Wait 5 seconds and repeat step 3
   Expect the returned block number (hex) to have increased
5. Run: curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'
   Expect result "0x0"
```

**Verification checklist**:
- [ ] `docker compose ps` shows both containers healthy
- [ ] `docker compose logs besu-rpc` shows peer count >= 1
- [ ] `eth_blockNumber` increases across two calls 5 seconds apart
- [ ] `eth_gasPrice` returns `0x0`

**Known limitations at this phase**: No contracts, no backend, no frontend exist yet - this deliverable is infra-only and has no browser surface.

**Phase exit gate summary** (see plan.md Phase 1 for full detail):
- [ ] DL-1.1 and DL-1.2 verified
- [ ] Both containers healthy and peered; `eth_blockNumber` increasing; `eth_gasPrice` returns `0x0`

---

## Phase 2 - Contracts

**Goal**: A developer can deploy the trimmed T-REX contract suite onto the Phase 1 network and prove, by an automated test, that non-compliant transfers are rejected.

**Prerequisites:**
```
Checklist:
- [ ] Node.js 20 LTS installed
- [ ] npm install run inside contracts/ (Hardhat, ethers.js)
- [ ] Phase 1 exit gate passed (DL-1.1, DL-1.2 verified, besu-rpc reachable at localhost:8545)
- [ ] hardhat.config.ts network "besu" points at http://localhost:8545
```

---

##### DL-2.1 - Deployed trimmed T-REX suite

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 2 - Contracts |
| **Milestone** | N/A |
| **Traces to** | PRD US-002, plan.md PD-2.1 |
| **Demo surface** | `deployed-addresses.json`, `npx hardhat console --network besu` |

**What it is**: The six trimmed T-REX contracts (`Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance`) live on the Phase 1 network and wired together, with `Token` named "Digital Asset Token" / symbol `DAT`.

**How to try it**:
```
1. Run: npx hardhat run scripts/deploy.ts --network besu
2. Inspect deployed-addresses.json
   Expect 6 non-zero addresses, one per contract
3. Run: npx hardhat console --network besu
4. In the console: const token = await ethers.getContractAt("Token", "<address from deployed-addresses.json>")
5. Run: await token.name()
   Expect "Digital Asset Token"
6. Run: await token.symbol()
   Expect "DAT"
```

**Verification checklist**:
- [ ] `deployed-addresses.json` has 6 non-zero addresses
- [ ] `token.name()` returns "Digital Asset Token"
- [ ] `token.symbol()` returns "DAT"

**Known limitations at this phase**: No admin identities exist yet - the token has zero total supply until DL-2.2 mints. No UI exists to interact with these contracts yet - resolved by DL-4.1/DL-4.2.

---

##### DL-2.2 - Admin CLI scripts

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 2 - Contracts |
| **Milestone** | N/A |
| **Traces to** | PRD US-003, US-004, US-005, plan.md PD-2.2 |
| **Demo surface** | CLI, `npx hardhat run scripts/<name>.ts` |

**What it is**: Four Hardhat scripts that let a developer drive the full onboard-and-transfer flow from the terminal, without a UI - the fastest way to prove the chain-level logic works before the backend exists.

**How to try it**:
```
Note: Hardhat 2.x's `run` task does not support `--` positional passthrough to
scripts, so args are passed as env vars instead of the originally planned
`-- <arg>` syntax.

1. Run: WALLET=0xAnsonAddress npx hardhat run scripts/registerIdentity.ts --network besu
   Expect console output "registered: 0xAnsonAddress"
2. Run: WALLET=0xAnsonAddress npx hardhat run scripts/issueClaim.ts --network besu
   Expect console output "claim issued: 0xAnsonAddress"
3. Run: WALLET=0xAnsonAddress AMOUNT=100 npx hardhat run scripts/mintToken.ts --network besu
   Expect console output "minted 100 DAT to 0xAnsonAddress"
4. Repeat steps 1-3 for Beatrice's address (skip the mint if Beatrice only needs to be verified)
5. Run: FROM=0xAnsonAddress TO=0xBeatriceAddress AMOUNT=50 npx hardhat run scripts/transfer.ts --network besu
   Expect console output "transferred 50 DAT, tx: 0x..."
```

**Verification checklist**:
- [ ] All four scripts run to completion with exit code 0
- [ ] `token.balanceOf(0xAnsonAddress)` reflects the mint and transfer
- [ ] `token.balanceOf(0xBeatriceAddress)` reflects the transfer

**Known limitations at this phase**: CLI-only, no web UI, no audit log persistence (that is a backend concern - DL-3.3). This is a developer/debug tool, not the end-user surface.

---

##### DL-2.3 - Hardhat compliance test suite

| Field | Value |
|---|---|
| **Type** | test |
| **Phase** | Phase 2 - Contracts |
| **Milestone** | N/A |
| **Traces to** | PRD US-002, US-007, plan.md PD-2.3, anti-gate |
| **Demo surface** | `npx hardhat test` output |

**What it is**: The automated proof that the ERC-3643 compliance guarantee (D-01) is real - a transfer to an unverified address must revert.

**How to try it**:
```
1. Run: npx hardhat test
2. Locate the test named "reverts transfer to unverified recipient"
3. Locate the test named "succeeds transfer to verified recipient"
```

**Verification checklist**:
- [ ] `npx hardhat test` exits 0
- [ ] Compliance-rejection test passes (asserts revert)
- [ ] Compliance-success test passes (asserts balances update)

**Known limitations at this phase**: Contract-level tests only - does not prove the backend or frontend surface the rejection correctly to a human. Resolved by DL-4.3 (`compliance-rejection.spec.ts`).

**Phase exit gate summary** (see plan.md Phase 2 for full detail):
- [ ] DL-2.1, DL-2.2, DL-2.3 verified
- [ ] `npx hardhat test` green including the compliance-rejection test; Admin CLI scripts run end to end against the live network

---

## Phase 3 - Backend API

**Goal**: A developer can drive the entire onboarding-and-transfer flow via `curl` against a running `backend-api`, with private keys never appearing in any response.

**Prerequisites:**
```
Checklist:
- [ ] Phase 2 exit gate passed, deployed-addresses.json exists
- [ ] .env.local populated with ADMIN_PRIVATE_KEY, ANSON_PRIVATE_KEY, BEATRICE_PRIVATE_KEY, BESU_RPC_URL=http://localhost:8545
- [ ] npm install run inside backend-api/
```

---

##### DL-3.1 - 6 REST endpoints

| Field | Value |
|---|---|
| **Type** | api |
| **Phase** | Phase 3 - Backend API |
| **Milestone** | N/A |
| **Traces to** | PRD US-008, FR-4, FR-5, FR-6, FR-7, plan.md PD-3.1 |
| **Demo surface** | `curl` against `http://localhost:4000` |

**What it is**: The full REST surface the frontend will use - `POST /admin/register-identity`, `POST /admin/issue-claim`, `POST /admin/mint`, `POST /transfer`, `GET /balance/:who`, `GET /transfers`.

**How to try it**:
```
1. Run: npm run dev (starts backend-api on :4000)
2. Run: curl -X POST http://localhost:4000/admin/register-identity -H "Content-Type: application/json" -d '{"who":"anson"}'
   Expect: 200 {"status":"registered"}
3. Run: curl -X POST http://localhost:4000/admin/issue-claim -H "Content-Type: application/json" -d '{"who":"anson"}'
   Expect: 200 {"status":"verified"}
4. Run: curl -X POST http://localhost:4000/admin/mint -H "Content-Type: application/json" -d '{"who":"anson","amount":100}'
   Expect: 200 {"status":"minted","balance":100}
5. Repeat steps 2-4 for beatrice
6. Run: curl -X POST http://localhost:4000/transfer -H "Content-Type: application/json" -d '{"from":"anson","to":"beatrice","amount":50}'
   Expect: 200 {"status":"success","balances":{"anson":50,"beatrice":50}}
7. Run: curl http://localhost:4000/balance/anson
   Expect: 200 {"who":"anson","balance":50}
```

**Verification checklist**:
- [x] All 6 endpoints return the expected shape above
- [x] No response body anywhere contains a private key or raw signer data (spot-check with `curl -v` and read the full body)
- [x] Typecheck passes: `npm run typecheck`

**Known limitations at this phase**: No auth on any route (documented accepted risk R5) - safe only because bound to localhost. No UI yet - resolved by DL-4.1/DL-4.2.

---

##### DL-3.2 - Service-layer unit tests

| Field | Value |
|---|---|
| **Type** | test |
| **Phase** | Phase 3 - Backend API |
| **Milestone** | N/A |
| **Traces to** | PRD US-003 to US-008, plan.md PD-3.2 |
| **Demo surface** | `npm run test` output |

**What it is**: Unit tests for `ComplianceAdminService` and `TransferService` with a mocked `ChainService`, proving the orchestration logic (ordering, idempotency, error handling) is correct without needing a live chain for every run.

**How to try it**:
```
1. Run: npm run test -- --testPathPattern=services
2. Review output for suites: ComplianceAdminService, TransferService
```

**Verification checklist**:
- [x] All service-layer tests pass
- [x] Idempotent `registerIdentity` (calling twice) is explicitly covered and passes
- [x] Compliance-rejection error path is explicitly covered and passes

**Known limitations at this phase**: Mocked `ChainService` - these tests do not prove the real chain integration works; DL-3.1's manual `curl` walkthrough covers that.

---

##### DL-3.3 - SQLite audit log

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 3 - Backend API |
| **Milestone** | N/A |
| **Traces to** | PRD US-006, FR-7, plan.md PD-3.3 |
| **Demo surface** | `sqlite3 backend-api/transfers.db` |

**What it is**: The local, file-based audit log that records every successful transfer (`from`, `to`, `amount`, `txHash`, `timestamp`). Implemented with Node's built-in `node:sqlite` (`DatabaseSync`) rather than `better-sqlite3` — the latter needs a native C++ toolchain (node-gyp) to compile on this machine, which isn't installed; `node:sqlite` ships with Node itself (stable target Node 20 LTS per D-04, but this repo runs Node 24 locally where it works without flags) and needs no native build. Still a plain `.db` file, so `sqlite3 backend-api/transfers.db` works unchanged.

**How to try it**:
```
1. After completing DL-3.1 step 6 (a successful transfer), run: sqlite3 backend-api/transfers.db "select * from transfers"
2. Expect one row: anson | beatrice | 50 | 0x... | <timestamp>
```

**Verification checklist**:
- [x] `transfers.db` file exists after the backend starts
- [x] A row is written after a successful `/transfer` call
- [x] No row is written after a failed/reverted `/transfer` call

**Known limitations at this phase**: No UI to view this table yet - resolved by DL-4.2 (history table).

---

##### DL-3.4 - `backend-api` container wired into compose

| Field | Value |
|---|---|
| **Type** | infra |
| **Phase** | Phase 3 - Backend API |
| **Milestone** | N/A |
| **Traces to** | plan.md Phase 3 step 5 |
| **Demo surface** | `docker compose ps` |

**What it is**: The backend now runs as a container reaching `besu-rpc` over the internal Docker network, not just via local `npm run dev`.

**How to try it**:
```
1. Run: docker compose up -d backend-api
2. Run: docker compose ps
   Expect backend-api listed as "running"
3. Repeat the DL-3.1 curl walkthrough against http://localhost:4000 - same results, now from a container
```

**Verification checklist**:
- [x] `backend-api` container healthy in `docker compose ps`
- [x] All DL-3.1 curl checks still pass against the containerized backend

**Known limitations at this phase**: None - this closes out Phase 3.

**Phase exit gate summary** (see plan.md Phase 3 for full detail):
- [x] DL-3.1, DL-3.2, DL-3.3, DL-3.4 verified
- [x] All 6 endpoints manually verified via curl against the full Phase 1+2+3 stack; service-layer unit tests green; spot-check confirms no private key ever appears in a response body

---

## Phase 4 - Frontend + E2E

**Goal**: Anyone can open a browser, onboard both demo identities, send `DAT` from Anson to Beatrice, watch it get rejected against an unverified address, and see the full history - with 3 Playwright specs proving it all works from a clean start.

**Prerequisites:**
```
Checklist:
- [ ] Phase 3 exit gate passed
- [ ] npm install run inside frontend/
- [ ] npx playwright install run once (browser binaries)
- [ ] Full stack running: docker compose up -d
```

---

##### DL-4.1 - Admin panel

| Field | Value |
|---|---|
| **Type** | ui |
| **Phase** | Phase 4 - Frontend + E2E |
| **Milestone** | N/A |
| **Traces to** | PRD US-009, plan.md Phase 4 step 1 |
| **Demo surface** | Browser at `http://localhost:3000` |

**What it is**: The dashboard panel where Admin registers identities, issues claims, and mints `DAT`, without touching the CLI.

**How to try it**:
```
1. Open http://localhost:3000 in a browser
2. Click the "Admin" tab
3. Select "Anson", click "Register" - expect a success toast "Registered"
4. Click "Issue Claim" - expect a success toast "Verified"
5. Enter "100" in the mint amount field, click "Mint" - expect Anson's balance to show "100 DAT"
6. Repeat for Beatrice
7. Run: npx playwright test tests/onboarding.spec.ts
   Expect: 1 passed
```

**Verification checklist**:
- [ ] Manual walkthrough above succeeds for both identities
- [ ] Each action shows success/error feedback in the UI
- [ ] `npx playwright test tests/onboarding.spec.ts` exits 0

**Known limitations at this phase**: None once verified - this is the terminal deliverable for the onboarding use case (UC-03).

---

##### DL-4.2 - Transfer dashboard

| Field | Value |
|---|---|
| **Type** | feature |
| **Phase** | Phase 4 - Frontend + E2E |
| **Milestone** | N/A |
| **Traces to** | PRD US-010, US-011, plan.md Phase 4 step 2-3 |
| **Demo surface** | Browser at `http://localhost:3000` |

**What it is**: The panel where Anson and Beatrice switch identity, see their live balance, send `DAT`, and view transfer history - including the compliance-rejection error path.

**How to try it**:
```
1. Open http://localhost:3000, click the "Transfer" tab
2. In the "Acting as" dropdown, select "Anson" - expect Anson's balance shown (100 DAT if DL-4.1 was completed)
3. Enter Beatrice's address and "50" as amount, click "Send"
   Expect Anson's balance drops to 50, Beatrice's balance rises to 50
4. Scroll to the history table - expect one row showing the transfer just made
5. Enter an address never registered by Admin, enter "10", click "Send"
   Expect an inline error message, e.g. "Recipient is not a verified identity" - balances must not change
6. Run: npx playwright test tests/happy-path-transfer.spec.ts
   Expect: 1 passed
7. Run: npx playwright test tests/compliance-rejection.spec.ts
   Expect: 1 passed
```

**Verification checklist**:
- [ ] Identity switch updates the displayed balance correctly
- [ ] Successful transfer updates both balances and the history table without a full page reload
- [ ] Rejected transfer shows a clear, human-readable error and leaves balances unchanged
- [ ] `npx playwright test tests/happy-path-transfer.spec.ts` exits 0
- [ ] `npx playwright test tests/compliance-rejection.spec.ts` exits 0

**Known limitations at this phase**: Identity switch is demo-mode only (D-07) - not a real wallet connection; this is disclaimed in the README, not a bug.

---

##### DL-4.3 - 3 Playwright E2E specs

| Field | Value |
|---|---|
| **Type** | test |
| **Phase** | Phase 4 - Frontend + E2E |
| **Milestone** | N/A |
| **Traces to** | PRD US-012, D-13, plan.md Phase 4 exit gate |
| **Demo surface** | `npx playwright test` terminal output |

**What it is**: The full E2E suite covering onboarding, happy-path transfer, and compliance rejection - the strongest single proof that the whole stack is wired correctly.

**How to try it**:
```
1. Run: docker compose down -v
2. Run: docker compose up -d
3. Run: npm run seed (deploys contracts if not already deployed, or confirms addresses)
4. Run: npx playwright test
5. Review the HTML report: npx playwright show-report
```

**Verification checklist**:
- [ ] `npx playwright test` exits 0 with 3/3 specs passed
- [ ] Re-run the suite 3 times consecutively with no flaky failures (plan.md anti-gate)

**Known limitations at this phase**: None - this is the project's final quality gate.

---

##### DL-4.4 - README verified from a clean checkout

| Field | Value |
|---|---|
| **Type** | doc |
| **Phase** | Phase 4 - Frontend + E2E |
| **Milestone** | N/A |
| **Traces to** | plan.md PD-4.3 |
| **Demo surface** | Terminal, following README.md literally |

**What it is**: Proof that a stranger (or future-you, months later) can clone the repo and get a working demo using only the README - no tribal knowledge required.

**How to try it**:
```
1. In a fresh directory: git clone <this-repo> && cd my-besu-net
2. Follow README.md "Getting Started" section exactly, line by line
3. Confirm the "Accessing the Application" URLs all work as documented
```

**Verification checklist**:
- [ ] Every command in the README "Getting Started" section runs without modification
- [ ] The quick API test (`curl` for `eth_blockNumber`) returns a valid result
- [ ] The dashboard loads at `http://localhost:3000` and a transfer can be completed following only the README

**Known limitations at this phase**: None - this closes the project's MVP scope (plan.md §1 v1 wedge).

**Phase exit gate summary** (see plan.md Phase 4 for full detail):
- [ ] DL-4.1, DL-4.2, DL-4.3, DL-4.4 verified
- [ ] `npx playwright test` - 3/3 specs pass (onboarding, happy-path-transfer, compliance-rejection); README "Getting Started" followed literally from a clean checkout produces a working demo

---

## How to Run a Full End-to-End Demo

**1. Start the stack**
```bash
cp .env.example .env.local
# fill in ADMIN_PRIVATE_KEY, ANSON_PRIVATE_KEY, BEATRICE_PRIVATE_KEY
docker compose up -d
npm run seed
```

**2. Walk through the primary flow**
- Open `http://localhost:3000` and follow DL-4.1 to onboard Anson and Beatrice via the Admin panel.
- Follow DL-4.2 to switch to Anson, send `DAT` to Beatrice, and confirm both balances and the history table update.
- Follow DL-4.2 step 5 to show the compliance-rejection path against an address that was never onboarded.

**3. Show the key outputs**
- Browser: `http://localhost:3000` shows live balances and transfer history.
- Terminal: `curl http://localhost:8545` with `eth_blockNumber` shows the chain is live; `curl http://localhost:4000/balance/anson` shows the backend agrees with the chain.
- Terminal: `npx playwright test` shows 3/3 specs green as the final proof.

**4. Tear down**
```bash
docker compose down -v
```
