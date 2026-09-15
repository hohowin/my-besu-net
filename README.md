# besu-digital-asset-demo

A single-validator, single-RPC-node Hyperledger Besu network (QBFT, zero-gas) running a trimmed **ERC-3643 (T-REX)** permissioned digital asset. Demonstrates a compliant token transfer between two onboarded identities — Anson paying Beatrice — through an admin dashboard, a signing backend, and a live blockchain explorer view.

> **Personal learning PoC.** Anson and Beatrice are fictional demo identities. Private keys are stored in local server-side config for demo convenience only — this is not a production key-management model. No real PII is processed; no compliance framework (CASL / PIPEDA / GDPR / PCI) applies, because no real user data exists.

---

## What It Does

- Stands up a private, permissioned Ethereum network with Hyperledger Besu (QBFT consensus, 1 validator + 1 RPC node, zero gas fees).
- Deploys a trimmed ERC-3643 contract suite: transfers only succeed between wallets that are registered in the Identity Registry and hold a valid KYC claim from a Trusted Issuer.
- Lets an **Admin** onboard identities, issue claims, and mint tokens; lets **Anson** and **Beatrice** transfer the token to each other and see their balances update, with every transfer written to a local audit log.

## Who It Serves

| Actor | Role | Interacts via |
|---|---|---|
| **Admin** | Token Agent + Trusted Issuer — registers identities, issues KYC claims, mints `DAT` | Web dashboard (Admin panel) |
| **Anson** | Verified investor — sends `DAT` | Web dashboard (demo-mode identity switch) |
| **Beatrice** | Verified investor — receives `DAT` | Web dashboard (demo-mode identity switch) |

There is no real wallet software involved — the dashboard has a "currently acting as" selector instead of a MetaMask connection, and the backend signs transactions on the selected identity's behalf.

## Key Capabilities

- Permissioned transfer enforcement (ERC-3643 compliance check reverts transfers to/from unverified addresses)
- Admin onboarding flow: register identity → issue claim → mint
- Zero-gas transfers (no native currency needed to transact)
- Transfer history / audit log (SQLite)
- Playwright E2E coverage for onboarding, happy-path transfer, and compliance rejection

## Architecture At a Glance

| Service | Container | Exposed Port | Purpose |
|---|---|---|---|
| Besu validator | `besu-validator` | — (internal only) | Proposes/signs QBFT blocks |
| Besu RPC node | `besu-rpc` | `8545` (HTTP-RPC), `8546` (WS) | JSON-RPC endpoint the backend talks to |
| Backend API | `backend-api` | `4000` | Node/Express + ethers.js — holds demo private keys, signs transactions, writes audit log |
| Frontend | `frontend` | `3000` | React dashboard (Admin panel + transfer UI) |

Token: `Digital Asset Token` (`DAT`) — trimmed T-REX contracts: `Token`, `IdentityRegistry`, `IdentityRegistryStorage`, `ClaimTopicsRegistry`, `TrustedIssuersRegistry`, `ModularCompliance`. Per-investor OnchainID proxy contracts are intentionally omitted for v1 — wallet address is used directly as the identity key.

## Prerequisites

- Docker + Docker Compose
- Node.js 20 LTS
- npm

## Getting Started

```bash
# 1. Clone
git clone <this-repo>
cd my-besu-net

# 2. Configure env
cp .env.example .env.local
# fill in demo private keys / addresses for Admin, Anson, Beatrice
# (generate throwaway ones with: node -e "console.log(require('ethers').Wallet.createRandom())")

# 3. Install dependencies used by the seed script
cd contracts && npm install && cd ..
npm install   # root — only needed if you'll also run the Playwright E2E suite

# 4. Start the network + services (also builds the backend-api/frontend images)
docker compose up -d

# 5. Deploy contracts, onboard Anson/Beatrice, and mint a starting balance
npm run seed
```

Besu has no persistent volume for chain data (by design — see `docs/plan.md` D-15/D-16), so every `docker compose down` resets it to genesis. `npm run seed` always redeploys fresh contracts and restarts `backend-api` to pick up the new addresses — safe to re-run any time after a teardown.

## Accessing the Application

| What | URL |
|---|---|
| Frontend dashboard | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Besu JSON-RPC | http://localhost:8545 |

Quick API test:

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Key Documents

| Document | Purpose |
|---|---|
| [docs/prd.md](docs/prd.md) | Product requirements |
| [docs/architecture.md](docs/architecture.md) | Service architecture, integration patterns, security model |
| [docs/plan.md](docs/plan.md) | Phase plan, locked decisions, risk register |
| [docs/use-cases.md](docs/use-cases.md) | End-to-end flows with sequence diagrams |
| [docs/deliverables.md](docs/deliverables.md) | Phase-by-phase deliverables and "how to try it" guides |

## Development Notes

- Solo repo — commits go directly to `main`, no CI workflow (see `docs/plan.md` for rationale).
- Run `npm run typecheck` and `npm run test` locally (inside each of `contracts/`, `backend-api/`, `frontend/`) before considering a phase done.
- Admin setup actions are also reachable via CLI scripts in `contracts/scripts/` for scripting/debugging without the UI.
- End-to-end tests: `npx playwright test` from the repo root (needs the full stack already running — see `docs/deliverables.md` DL-4.3).

## Compliance Notes

This project simulates the shape of a regulated digital asset (ERC-3643 permissioned transfers) for learning purposes only. It is **not** audit-grade compliance tooling, does not implement full OnchainID, and must not be pointed at real user data or deployed to a public network.
