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
| **Anson** | Verified investor — sends and receives `DAT` | Web dashboard (demo-mode identity switch) |
| **Beatrice** | Verified investor — sends and receives `DAT` | Web dashboard (demo-mode identity switch) |

Transfers work in both directions — Anson → Beatrice and Beatrice → Anson — once both are onboarded and verified. Switch "Acting as" on the Transfer tab to send from whichever identity you're currently driving.

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

### Step 1 — Clone and configure

```bash
git clone <this-repo>
cd my-besu-net
cp .env.example .env.local
```

Open `.env.local` and fill in three throwaway private keys / addresses (Admin, Anson, Beatrice). These sign real transactions on the local network, but it's zero-gas and never leaves your machine, so any freshly generated key is fine — never reuse a key that holds real funds anywhere else:

```bash
node -e "
const { ethers } = require('ethers');
for (const name of ['ADMIN','ANSON','BEATRICE']) {
  const w = ethers.Wallet.createRandom();
  console.log(name + '_PRIVATE_KEY=' + w.privateKey);
  console.log(name + '_ADDRESS=' + w.address);
}
"
```

(This needs the `ethers` package — either run it from inside `contracts/` after step 2 below, or `npm install ethers` in a scratch folder first.)

### Step 2 — Install dependencies

```bash
cd contracts && npm install && cd ..   # needed for the seed script's contract deploy
npm install                            # root — only needed for the Playwright E2E suite
npx playwright install chromium        # once, only if you'll run the E2E suite
```

`backend-api/` and `frontend/` don't need a local `npm install` for the normal flow below — Docker installs their dependencies inside the image build.

### Step 3 — Start the stack

```bash
docker compose up -d --build
```

This builds and starts all 4 containers: `besu-validator`, `besu-rpc`, `backend-api`, `frontend`. Check they're all healthy:

```bash
docker compose ps
```

### Step 4 — Deploy contracts and onboard the demo identities

```bash
npm run seed
```

This deploys the trimmed T-REX contract suite fresh, restarts `backend-api` so it picks up the new contract addresses, then registers + verifies both Anson and Beatrice and mints Anson a starting balance of 1000 `DAT`. Takes about 15–20 seconds.

> Besu has no persistent volume for chain data (by design — see `docs/plan.md` D-15/D-16), so every `docker compose down` resets the chain back to genesis. `npm run seed` always redeploys fresh contracts rather than trusting a possibly-stale `deployed-addresses.json` — safe to re-run any time after a teardown.

### Step 5 — Open the dashboard

Go to **http://localhost:3000** — see [Demo Walkthrough](#demo-walkthrough) below for what to click.

### Tearing down

```bash
docker compose down -v   # stops everything and wipes the chain + audit log
```

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

## Demo Walkthrough

Everything below assumes the stack is up and `npm run seed` has already run (Anson has 1000 `DAT`, Beatrice has 0 but is verified).

### 1. Admin panel — onboard identities (if you skipped `npm run seed`, or want to see it manually)

1. Open http://localhost:3000 — the **Admin** tab is the default view, with a card for Anson and a card for Beatrice.
2. On a card, click **Register \<Name\>** — status shows `registered`.
3. Click **Issue Claim** — status shows `verified`. The identity can now hold and transfer `DAT`.
4. Enter an amount and click **Mint** — status shows `minted` and the card displays the new balance.

These steps are idempotent — clicking Register/Issue Claim again on an already-onboarded identity just confirms the status again, no error.

### 2. Transfer tab — send `DAT` either direction

1. Click the **Transfer** tab.
2. **Acting as** — choose who you're sending from: **Anson** or **Beatrice**. Their live balance appears underneath.
3. **Send to** — choose the recipient. This list automatically excludes whoever you're currently acting as, so if you're acting as Anson you'll see Beatrice (and Admin); switch **Acting as** to Beatrice and **Send to** will offer Anson instead — **Beatrice can send to Anson exactly the same way Anson can send to Beatrice**, since both are verified identities.
4. Enter an amount, click **Send**.
5. On success: the balance updates, status shows "Transfer sent", and a new row appears in the **Transfer history** table below.

### 3. Compliance rejection — see the actual contract guarantee fail closed

1. Still on the Transfer tab, set **Send to** to **Admin (unverified)** — Admin is a real identity in this demo but is deliberately never onboarded as a token holder.
2. Enter an amount, click **Send**.
3. Expect an inline error: `Token: recipient not verified`. The balance and history table are unchanged — nothing was silently swallowed, and nothing on-chain moved either (this reverts inside the smart contract itself, not just a frontend check).

### 4. Confirm it from the terminal too

```bash
# Chain is live
curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Backend agrees with the chain
curl -s http://localhost:4000/balance/anson
curl -s http://localhost:4000/balance/beatrice

# Full audit log of every transfer made through the dashboard
curl -s http://localhost:4000/transfers
```

### 5. Run the automated proof

```bash
npx playwright test          # 3 specs: onboarding, happy-path-transfer, compliance-rejection
npx playwright show-report   # view the HTML report
```

## Optional: Kaleido-Mimic Transport

> Post-MVP addition, not part of the core phase plan — full detail in [docs/kaleido-mock.md](docs/kaleido-mock.md).

[Kaleido](https://www.kaleido.io) is a commercial blockchain-platform-as-a-service; its free tier is a hosted cloud account, not something installable locally. `kaleido-mock/` is a small service built for this repo that reproduces Kaleido's *pattern* instead — a generic, ABI-driven REST gateway with async submission + receipt polling, holding the signing keys itself rather than `backend-api`.

```bash
# Requires the base stack already deployed once (see Getting Started above)
docker compose -f docker-compose.yml -f docker-compose.kaleido.yml up -d --build

docker logs backend-api --tail 5   # confirm: "chain transport: kaleido"
```

The dashboard at `http://localhost:3000` behaves identically — same UI, same `npx playwright test` specs pass unmodified. The only visible difference is slightly higher latency per write action (~5s vs ~2-3s), from the gateway's 1-second receipt-polling interval.

Try the gateway directly:

```bash
curl "http://localhost:5001/contracts/identityRegistry/isVerified?params=%5B%22<address>%22%5D"
curl -X POST http://localhost:5001/contracts/token/mint \
  -H "Content-Type: application/json" -d '{"params":["<address>",10],"from":"admin"}'
curl http://localhost:5001/receipts/<id-from-previous-response>
```

Back to the default (direct) transport:

```bash
docker compose -f docker-compose.yml -f docker-compose.kaleido.yml down
docker compose up -d --build
npm run seed
```

## Key Documents

| Document | Purpose |
|---|---|
| [docs/prd.md](docs/prd.md) | Product requirements |
| [docs/architecture.md](docs/architecture.md) | Service architecture, integration patterns, security model |
| [docs/plan.md](docs/plan.md) | Phase plan, locked decisions, risk register |
| [docs/use-cases.md](docs/use-cases.md) | End-to-end flows with sequence diagrams |
| [docs/deliverables.md](docs/deliverables.md) | Phase-by-phase deliverables and "how to try it" guides |
| [docs/kaleido-mock.md](docs/kaleido-mock.md) | Optional demo mode: a local mimic of Kaleido's ABI-gateway + async-receipt pattern in front of Besu |

## Development Notes

- Solo repo — commits go directly to `main`, no CI workflow (see `docs/plan.md` for rationale).
- Run `npm run typecheck` and `npm run test` locally (inside each of `contracts/`, `backend-api/`, `frontend/`) before considering a phase done.
- Admin setup actions are also reachable via CLI scripts in `contracts/scripts/` for scripting/debugging without the UI.
- End-to-end tests: `npx playwright test` from the repo root (needs the full stack already running — see `docs/deliverables.md` DL-4.3).

## Compliance Notes

This project simulates the shape of a regulated digital asset (ERC-3643 permissioned transfers) for learning purposes only. It is **not** audit-grade compliance tooling, does not implement full OnchainID, and must not be pointed at real user data or deployed to a public network.
