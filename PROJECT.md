# PROJECT.md — besu-digital-asset-demo

> Architecture, conventions, and commands for this repo. Full rationale lives in `docs/`; this file is the quick-reference layer CLAUDE.md points to.

## What This Is

Solo learning PoC: a permissioned ERC-3643 (T-REX) digital asset (`DAT`) transferred between two demo identities (Anson, Beatrice) on a private single-validator Hyperledger Besu network (QBFT, zero-gas), managed through an Admin web dashboard. Not audit-grade, no real PII, localhost-only. Full context: [README.md](README.md), [docs/prd.md](docs/prd.md).

## Current Status

**Phase 1 (Network) — done.** `besu-validator` + `besu-rpc` run via Docker Compose, QBFT producing blocks, zero-gas confirmed (see `docs/plan.md` §4 M1.2 exit gate, all checked).

**Phase 2 (Contracts) — done.** Trimmed T-REX suite (6 contracts) deployed and verified live on the Phase 1 network: `npx hardhat test` 10/10 green including both compliance-rejection anti-gate tests; admin CLI register→claim→mint→transfer walkthrough run end to end for Anson and Beatrice; a transfer to a never-onboarded address reverts on-chain with `Token: recipient not verified` (see `docs/plan.md` §4 Phase 2 exit gate, all checked).

**Phase 3 (Backend API) — done.** Express backend (`backend-api/`) exposes all 6 REST endpoints, backed by `ChainService`/`ComplianceAdminService`/`TransferService`/`AuditLogRepository`. 8/8 service-layer unit tests green (mocked `ChainService`), all endpoints manually verified via curl both locally and containerized — including the compliance-rejection path returning a clean 400, and confirmed no private key ever appears in a response body (see `docs/plan.md` §4 Phase 3 exit gate, all checked). Deviation: uses Node's built-in `node:sqlite` instead of `better-sqlite3` — no C++ toolchain available locally to compile it.

**Phase 4 (Frontend + E2E) — done. All 4 phases complete — MVP shipped (v1 wedge, `docs/plan.md` §1).** React/Vite dashboard (`frontend/`) with `AdminPanel` + `TransferDashboard`, wired into `docker-compose.yml` (nginx, :3000). 3/3 Playwright specs (`onboarding`, `happy-path-transfer`, `compliance-rejection`) green across 3 consecutive runs against a genuinely fresh `docker compose down -v && up -d --build && npm run seed` — not just a warm re-run (see `docs/plan.md` §4 Phase 4 exit gate, all checked).

Two bugs surfaced and fixed during Phase 4 E2E testing (both in `backend-api/src/chain/ChainService.ts`, neither caught by Phase 3's mocked unit tests since they're real-chain timing/nonce issues):
- Plain `ethers.Wallet` signers raced on Besu's "pending" nonce when two admin-signed sends happened close together → switched to `ethers.NonceManager` (in-process nonce tracking).
- `NonceManager` reserves a nonce while populating a tx and doesn't roll it back if `eth_estimateGas` reverts (no tx ever broadcast, so nothing was actually consumed on-chain) → every later send from that identity then hung forever waiting for a nonce that would never arrive. Fixed with `ChainService.resetNonce()`, called from both services' catch blocks on any failed send.

Also added: `ComplianceAdminService.registerIdentity`/`issueClaim` now check `isRegistered`/`isVerified` first and skip sending a transaction when already true — was previously sending (and paying full block-confirmation latency for) a no-op transaction every time, which made repeated E2E runs slow and cumulatively pushed chain state further from a clean baseline.

All phases are done; project is at MVP scope per `docs/plan.md` §1 v1 wedge — see §10 Out of Scope for what's deliberately not built.

## Repo Layout (current)

```
network-config/
  genesis.json          # QBFT genesis, minGasPrice = 0
  qbft-config.json
  validator-key/        # validator private key (gitignored contents)
docker-compose.yml       # besu-validator + besu-rpc (Phase 1 only so far)
contracts/               # Phase 2: Hardhat + TS strict project
  contracts/              # trimmed T-REX suite (6 .sol files, incl. compliance/)
  scripts/                # deploy.ts + admin CLI (registerIdentity/issueClaim/mintToken/transfer)
  test/compliance.test.ts # 10 tests incl. compliance-rejection anti-gate
backend-api/             # Phase 3: Express + TS strict project
  src/chain/ChainService.ts    # the only module holding private keys (D-09)
  src/services/                # ComplianceAdminService, TransferService
  src/db/AuditLogRepository.ts # node:sqlite-backed transfers log
  src/api/                     # Express routes + error handler
  test/services/                # 8 tests, mocked ChainService
  Dockerfile
docs/
  prd.md                 # product requirements, user stories
  architecture.md         # service architecture, integration patterns, security model
  plan.md                 # phase plan, locked decisions (D-01..D-24), risk register
  use-cases.md            # end-to-end flows, sequence diagrams
  deliverables.md          # phase-by-phase "how to try it" guides
  skills-required.md
frontend/                # Phase 4: React + Vite + TS strict project
  src/api/ApiClient.ts    # thin wrapper over the backend-api REST surface
  src/components/          # AdminPanel, TransferDashboard
  Dockerfile               # multi-stage build -> nginx:alpine, served on :3000
tests/                   # Phase 4: Playwright specs (repo-root, not inside frontend/)
  onboarding.spec.ts
  happy-path-transfer.spec.ts
  compliance-rejection.spec.ts
playwright.config.ts      # baseURL :3000 (containerized frontend), workers:1 (shared real chain state)
scripts/seed.js            # root `npm run seed` — redeploys contracts + onboards + mints (see docs/deliverables.md DL-4.3)
.env.example              # placeholder template — copy to .env.local (gitignored) and fill in
deployed-addresses.json    # generated by `npm run deploy:besu`, gitignored (resets every `docker compose down` — no persistent Besu volume, D-15/D-16)
CLAUDE.md / PERSONA.md / PROJECT.md   # agent operating instructions
```

## Architecture (summary)

Modular monolith backend + thin SPA + 2-node blockchain infra tier — 4 Docker Compose services (`besu-validator`, `besu-rpc`, `backend-api`, `frontend`). No event broker; all integration is sync REST or direct in-process calls (D-17). Full detail, diagrams, and per-module rationale: [docs/architecture.md](docs/architecture.md).

| Layer | Owns | Talks to |
|---|---|---|
| T-REX Contract Suite (on-chain) | Identity/claim/balance state, compliance enforcement | `besu-rpc` |
| `backend-api` (Express monolith) | Demo private keys, transaction signing, audit log | `besu-rpc` (JSON-RPC), SQLite |
| `frontend` (React SPA) | UI only, no secrets | `backend-api` (REST) |

**Hard boundary:** the contract layer is the real authorization boundary — the backend cannot bypass compliance checks even if it wanted to. Keys live only in `backend-api`, never in the browser (FR-8).

## Conventions

- **Language/runtime:** TypeScript strict. No JS. Runtime is Node 24 (not the CIBC-default Node 20 LTS) — required by `node:sqlite` in `backend-api`; `contracts/` and `frontend/` follow suit for consistency across the repo. Docker images pin `node:24-alpine`.
- **Contracts:** Solidity + Hardhat.
- **Chain client:** ethers.js.
- **DB:** SQLite, no ORM, single `transfers` table — `node:sqlite` (`DatabaseSync`), not `better-sqlite3` (no native C++ toolchain available locally to compile it).
- **Naming:** avoid hardcoding `anson`/`beatrice`/`DAT` into logic — model as generic `identity` and `asset` records even though only one instance of each exists in v1 (see `docs/plan.md` §2).
- **Layering:** API layer (Express routes) stays a thin adapter — no chain calls, no SQL, no business invariants directly in route handlers. Invariants (e.g. "claim requires prior registration") live in the owning service (`ComplianceAdminService`, `TransferService`).
- **Secrets:** `.env.local`, gitignored, never logged or returned in API responses.
- **No auth layer in MVP** — accepted risk, mitigated only by localhost/Docker-internal-network binding (D-19, R5). Do not add production auth speculatively; do not deploy this beyond localhost.
- **Git:** solo repo, commit directly to `main`, no CI (D-16).

## Commands

**Now (Phase 1):**
```bash
docker compose up -d              # start besu-validator + besu-rpc
docker compose ps                 # confirm both running, no restart loop
docker compose logs besu-rpc      # check peering (peer count >= 1)
docker compose down -v            # tear down + remove volumes

curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Now (Phase 2, run inside `contracts/`):**
```bash
npm install
npm run compile
npm run test                      # 10 tests, incl. compliance-rejection anti-gate
npm run typecheck
npm run deploy:besu               # requires docker compose up -d + .env.local with ADMIN_PRIVATE_KEY

# Admin CLI (env vars, not `--` args — Hardhat 2.x's `run` task doesn't support positional passthrough)
WALLET=<addr> npx hardhat run scripts/registerIdentity.ts --network besu
WALLET=<addr> npx hardhat run scripts/issueClaim.ts --network besu
WALLET=<addr> AMOUNT=<n> npx hardhat run scripts/mintToken.ts --network besu
FROM=<addr> TO=<addr> AMOUNT=<n> npx hardhat run scripts/transfer.ts --network besu
```

**Now (Phase 3, run inside `backend-api/`):**
```bash
npm install
npm run typecheck
npm run test                      # 8 tests, mocked ChainService
npm run dev                       # starts backend-api on :4000 (needs deployed-addresses.json + .env.local)

# or containerized (from repo root):
docker compose up -d --build backend-api

curl -X POST http://localhost:4000/admin/register-identity -H "Content-Type: application/json" -d '{"who":"anson"}'
curl http://localhost:4000/balance/anson
```

**Now (Phase 4, run inside `frontend/`):**
```bash
npm install
npm run typecheck                 # tsc -b
npm run dev                       # Vite dev server on :5173

# or containerized (from repo root):
docker compose up -d --build frontend   # nginx on :3000
```

**Now (E2E, from repo root):**
```bash
npm install
npx playwright install chromium   # once

docker compose down -v && docker compose up -d --build   # fresh full stack
npm run seed                      # redeploys contracts, onboards, mints
npx playwright test               # 3 specs: onboarding, happy-path-transfer, compliance-rejection
npx playwright show-report
```

## Verification Before Calling a Phase Done

Each phase has an explicit exit gate in `docs/plan.md` §4 — check it literally, don't eyeball it:
- Phase 1: both containers healthy/peered, `eth_blockNumber` increasing, `eth_gasPrice` = `0x0`
- Phase 2: `npx hardhat test` green including compliance-rejection revert test; admin CLI register→claim→mint works end to end
- Phase 3: all 6 REST endpoints manually verified via curl (done, both local and containerized); zero private-key leakage in any response (done)
- Phase 4: 3/3 Playwright specs green across 3 consecutive runs against a fresh stack (done, non-flaky)

## Related Artifacts

- [docs/prd.md](docs/prd.md) — requirements, user stories
- [docs/architecture.md](docs/architecture.md) — full architecture, integration patterns, security model
- [docs/plan.md](docs/plan.md) — phase plan, locked decisions D-01–D-24, risk register
- [docs/use-cases.md](docs/use-cases.md) — sequence diagrams per flow
- [docs/deliverables.md](docs/deliverables.md) — phase-by-phase "how to try it" guides
