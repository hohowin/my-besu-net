# PROJECT.md — besu-digital-asset-demo

> Architecture, conventions, and commands for this repo. Full rationale lives in `docs/`; this file is the quick-reference layer CLAUDE.md points to.

## What This Is

Solo learning PoC: a permissioned ERC-3643 (T-REX) digital asset (`DAT`) transferred between two demo identities (Anson, Beatrice) on a private single-validator Hyperledger Besu network (QBFT, zero-gas), managed through an Admin web dashboard. Not audit-grade, no real PII, localhost-only. Full context: [README.md](README.md), [docs/prd.md](docs/prd.md).

## Current Status

**Phase 1 (Network) — done.** `besu-validator` + `besu-rpc` run via Docker Compose, QBFT producing blocks, zero-gas confirmed (see `docs/plan.md` §4 M1.2 exit gate, all checked).

**Phase 2 (Contracts) — not started.** No `contracts/` directory, no Hardhat config, no `package.json` yet.

**Phases 3–4 (Backend API, Frontend + E2E) — not started.**

Phases are strictly sequential with hard exit gates (D-14) — see `docs/plan.md` §4 for the full gate checklist before starting the next phase.

## Repo Layout (current)

```
network-config/
  genesis.json          # QBFT genesis, minGasPrice = 0
  qbft-config.json
  validator-key/        # validator private key (gitignored contents)
docker-compose.yml       # besu-validator + besu-rpc (Phase 1 only so far)
docs/
  prd.md                 # product requirements, user stories
  architecture.md         # service architecture, integration patterns, security model
  plan.md                 # phase plan, locked decisions (D-01..D-24), risk register
  use-cases.md            # end-to-end flows, sequence diagrams
  deliverables.md          # phase-by-phase "how to try it" guides
  skills-required.md
CLAUDE.md / PERSONA.md / PROJECT.md   # agent operating instructions
```

**Planned additions (per phase, not yet created):**
- Phase 2 → `contracts/` (Solidity, Hardhat config, deploy + admin CLI scripts, `deployed-addresses.json`)
- Phase 3 → `backend-api/` (Express + ethers.js + TS strict; `ChainService`, `ComplianceAdminService`, `TransferService`, `AuditLogRepository`; SQLite `transfers.db`; `.env.local` for demo keys)
- Phase 4 → `frontend/` (React + Vite; `AdminPanel`, `TransferDashboard`, `ApiClient`); `tests/` (Playwright specs: `onboarding`, `happy-path-transfer`, `compliance-rejection`)

## Architecture (summary)

Modular monolith backend + thin SPA + 2-node blockchain infra tier — 4 Docker Compose services total once all phases land. No event broker; all integration is sync REST or direct in-process calls (D-17). Full detail, diagrams, and per-module rationale: [docs/architecture.md](docs/architecture.md).

| Layer | Owns | Talks to |
|---|---|---|
| T-REX Contract Suite (on-chain) | Identity/claim/balance state, compliance enforcement | `besu-rpc` |
| `backend-api` (Express monolith) | Demo private keys, transaction signing, audit log | `besu-rpc` (JSON-RPC), SQLite |
| `frontend` (React SPA) | UI only, no secrets | `backend-api` (REST) |

**Hard boundary:** the contract layer is the real authorization boundary — the backend cannot bypass compliance checks even if it wanted to. Keys live only in `backend-api`, never in the browser (FR-8).

## Conventions

- **Language/runtime:** TypeScript strict, Node.js 20 LTS. No JS.
- **Contracts:** Solidity + Hardhat.
- **Chain client:** ethers.js.
- **DB:** SQLite, no ORM (`better-sqlite3`, direct queries) — single `transfers` table.
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

**Planned (from Phase 2 onward, once `package.json` exists):**
```bash
npx hardhat compile
npx hardhat test
npx hardhat run scripts/registerIdentity.ts --network besu

npm run typecheck
npm run test -- --testPathPattern=<file>
npm run seed                      # one-time admin onboarding + mint
npx playwright test               # Phase 4: 3 E2E specs
```

## Verification Before Calling a Phase Done

Each phase has an explicit exit gate in `docs/plan.md` §4 — check it literally, don't eyeball it:
- Phase 1: both containers healthy/peered, `eth_blockNumber` increasing, `eth_gasPrice` = `0x0`
- Phase 2: `npx hardhat test` green including compliance-rejection revert test; admin CLI register→claim→mint works end to end
- Phase 3: all 6 REST endpoints manually verified via curl; zero private-key leakage in any response
- Phase 4: 3/3 Playwright specs green across 3 consecutive local runs (non-flaky)

## Related Artifacts

- [docs/prd.md](docs/prd.md) — requirements, user stories
- [docs/architecture.md](docs/architecture.md) — full architecture, integration patterns, security model
- [docs/plan.md](docs/plan.md) — phase plan, locked decisions D-01–D-24, risk register
- [docs/use-cases.md](docs/use-cases.md) — sequence diagrams per flow
- [docs/deliverables.md](docs/deliverables.md) — phase-by-phase "how to try it" guides
