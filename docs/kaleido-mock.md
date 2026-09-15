# Kaleido-Mimic Middleware — Optional Demo Mode

> Not part of the core Phase 1-4 plan (`docs/plan.md`) or its locked decisions — this is a separate, optional demo added afterward to illustrate a different architecture style. The default stack (`docker compose up -d`) is unaffected and remains the documented, tested path.

## Why this exists

[Kaleido](https://www.kaleido.io) is a commercial blockchain-platform-as-a-service. Its distinguishing pattern (versus a plain JSON-RPC wrapper) is:

1. **A generic, ABI-driven REST gateway** — you give it a contract's ABI and it exposes every method as a REST endpoint, without knowing or caring what the contract does.
2. **Async submission with receipt polling** — a write call returns immediately with a receipt id; you poll a separate endpoint until it confirms or fails. Your app never blocks on a full block-confirmation cycle inline.
3. **The gateway holds the signing keys, not your application.**

Kaleido itself isn't installable for free (see the pricing note in the repo history / README discussion) — the free "Starter" tier is a hosted cloud account, not something you `docker run` locally. `kaleido-mock/` is a small, self-contained service built for this repo that reproduces the *pattern* above (not Kaleido's actual API surface, and not affiliated with or endorsed by Kaleido) so the architecture can be demonstrated without an external account.

## Architecture

```
Default stack:     frontend -> backend-api (holds keys, ethers.js direct) -> besu-rpc

Kaleido-mock mode:  frontend -> backend-api (no keys) -> kaleido-mock (holds keys) -> besu-rpc
                                                          ^ generic ABI gateway + async receipts
```

`backend-api`'s application logic — `ComplianceAdminService`, `TransferService`, `AuditLogRepository`, and all 6 REST routes — is **completely unchanged** between the two modes. Only the `ChainServiceLike` implementation differs:

| | `ChainService` (default) | `KaleidoChainService` (this mode) |
|---|---|---|
| Holds private keys | Yes (`backend-api` process) | No — `kaleido-mock` does |
| Talks to Besu via | ethers.js `JsonRpcProvider` directly | HTTP to `kaleido-mock`'s REST gateway |
| Write call returns | Waits for `tx.wait()` internally, returns receipt | Same external behavior — `KaleidoChainService`'s proxy polls `kaleido-mock`'s `/receipts/:id` internally and only resolves once settled, so callers see no difference |
| Nonce handling | `ethers.NonceManager` in `backend-api` | `ethers.NonceManager` in `kaleido-mock` (same fix, same reasoning — see `backend-api/src/chain/ChainService.ts`) |

Selected by `CHAIN_TRANSPORT` (`direct` default, `kaleido` to opt in) — see `backend-api/src/index.ts`.

## `kaleido-mock`'s REST surface

Generic, contract-agnostic — the same two endpoints work for any method on either registered contract (`identityRegistry`, `token`):

```
GET  /contracts/:instance/:method?params=[...]     # view/pure methods only, synchronous
POST /contracts/:instance/:method                   # state-changing methods
     body: { "params": [...], "from": "admin" | "anson" | "beatrice" }
     -> 202 { "id": "<txHash>", "status": "submitted" }   (async — doesn't wait for confirmation)
     -> 400 { "error": "..." }                            (sync — reverted during gas estimation, nothing was ever broadcast)

GET  /receipts/:id
     -> { "id", "status": "pending" | "success" | "error", "transactionHash"?, "error"? }
```

Try it directly:

```bash
# View call
curl "http://localhost:5001/contracts/identityRegistry/isVerified?params=%5B%22<address>%22%5D"

# Write call
curl -X POST http://localhost:5001/contracts/token/mint \
  -H "Content-Type: application/json" \
  -d '{"params":["<address>",10],"from":"admin"}'
# -> {"id":"0xabc...","status":"submitted"}

curl http://localhost:5001/receipts/0xabc...
# -> {"id":"0xabc...","status":"success","transactionHash":"0xabc...","blockNumber":123}
```

## Running it

```bash
# Base stack must already be deployed once (contracts + .env.local) — see README Getting Started.
docker compose -f docker-compose.yml -f docker-compose.kaleido.yml up -d --build
```

This adds `kaleido-mock` (port `5001`) and overrides `backend-api`'s environment (`CHAIN_TRANSPORT=kaleido`, `KALEIDO_GATEWAY_URL=http://kaleido-mock:5001`) — everything else (`besu-validator`, `besu-rpc`, `frontend`) is untouched.

The dashboard at `http://localhost:3000` behaves identically — same UI, same REST contract from the frontend's point of view, same Playwright specs pass unmodified (`npx playwright test`). The only observable difference is a slightly higher latency per write action (~5s vs ~2-3s), from `kaleido-mock`'s 1-second receipt-polling interval — a direct, visible consequence of the async gateway pattern.

To go back to the default (direct) mode:

```bash
docker compose -f docker-compose.yml -f docker-compose.kaleido.yml down
docker compose up -d --build
npm run seed
```

## What this does and doesn't prove

**Does show:**
- The generic-ABI-gateway + async-receipt pattern actually works against a real Besu network with a real ERC-3643 contract, not a toy example.
- That app-layer business logic (compliance orchestration, audit logging) is genuinely decoupled from chain transport when it depends only on an interface (`ChainServiceLike`), not a concrete client.
- The same nonce-management pitfall (`NonceManager` not rolling back a reservation on a failed `eth_estimateGas`) reappears in any service that submits transactions on behalf of multiple identities — this isn't a one-off `backend-api` quirk, it's inherent to the pattern.

**Doesn't show:**
- Real Kaleido's actual API shape, auth model, or any of its production features (webhooks, event streams, multi-region, HSM-backed signing, etc.) — this is a minimal illustrative mimic, not a spec-compliant clone.
- Production readiness — `kaleido-mock`'s receipt store is in-memory only (state is lost on restart), and it inherits the same "no auth" posture as the rest of this demo (D-19).
