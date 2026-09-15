import { ethers } from "ethers";
import { Identity } from "../identities";
import { ChainServiceLike } from "./ChainService";

type ContractInstance = "identityRegistry" | "token";

const VIEW_METHODS = new Set(["isRegistered", "isVerified", "balanceOf", "name", "symbol"]);

interface SubmitResponse {
  id: string;
  status: "submitted";
}

interface Receipt {
  id: string;
  status: "pending" | "success" | "error";
  transactionHash?: string;
  error?: string;
}

async function pollReceipt(gatewayUrl: string, id: string, tries = 60, delayMs = 1000): Promise<{ hash: string }> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${gatewayUrl}/receipts/${id}`);
    const receipt = (await res.json()) as Receipt;
    if (receipt.status === "success") {
      return { hash: receipt.transactionHash ?? id };
    }
    if (receipt.status === "error") {
      throw { reason: receipt.error }; // eslint-disable-line no-throw-literal -- shape matches extractRevertReason
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Receipt ${id} did not resolve after ${tries} attempts`);
}

/// A "contract" here is a thin proxy over the kaleido-mock gateway's
/// generic REST surface, not a real ethers.Contract — but it's duck-typed
/// to match exactly how ComplianceAdminService/TransferService already use
/// one: `await c.someMethod(...)` for a view call resolves straight to the
/// value; for a write call it resolves to `{ hash, wait() }`, same shape as
/// ethers' own TransactionResponse. Neither service needed to change at all
/// to run against this transport instead of direct ethers.js.
function createContractProxy(gatewayUrl: string, instance: ContractInstance, from: Identity): ethers.Contract {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return async (...params: unknown[]) => {
        if (VIEW_METHODS.has(prop)) {
          const query = encodeURIComponent(JSON.stringify(params));
          const res = await fetch(`${gatewayUrl}/contracts/${instance}/${prop}?params=${query}`);
          const body = (await res.json()) as { output?: unknown; error?: string };
          if (!res.ok) {
            throw { reason: body.error }; // eslint-disable-line no-throw-literal
          }
          return body.output;
        }

        const res = await fetch(`${gatewayUrl}/contracts/${instance}/${prop}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ params, from }),
        });
        const body = (await res.json()) as SubmitResponse & { error?: string };
        if (!res.ok) {
          throw { reason: body.error }; // eslint-disable-line no-throw-literal
        }
        return {
          hash: body.id,
          wait: () => pollReceipt(gatewayUrl, body.id),
        };
      };
    },
  };
  return new Proxy({}, handler) as unknown as ethers.Contract;
}

/// Same ChainServiceLike surface as the direct-ethers ChainService, but
/// this one holds no private keys at all — kaleido-mock does (see its
/// chain.ts). The application layer (this service, ComplianceAdminService,
/// TransferService, AuditLogRepository) is unchanged either way; only the
/// transport to Besu differs. Selected via CHAIN_TRANSPORT=kaleido
/// (see index.ts) — see docker-compose.kaleido.yml for the override that
/// brings kaleido-mock online and points this at it.
export class KaleidoChainService implements ChainServiceLike {
  constructor(
    private readonly gatewayUrl: string,
    private readonly walletAddresses: Record<Identity, string>,
  ) {}

  getAddress(identity: Identity): string {
    return this.walletAddresses[identity];
  }

  identityRegistry(asIdentity: Identity = "admin"): ethers.Contract {
    return createContractProxy(this.gatewayUrl, "identityRegistry", asIdentity);
  }

  token(asIdentity: Identity = "admin"): ethers.Contract {
    return createContractProxy(this.gatewayUrl, "token", asIdentity);
  }

  resetNonce(): void {
    // Nonce management now lives entirely inside kaleido-mock, which holds
    // the keys and does the actual signing/submission — nothing to reset
    // on this side of the REST boundary.
  }
}

/// The mimic gateway signs on the application's behalf, but this process
/// still needs to know each identity's *address* (not its key) to build
/// request bodies and to answer GET /balance/:who — addresses aren't
/// secret, so reading them from the same .env.local is fine.
export function loadWalletAddressesFromEnv(env: NodeJS.ProcessEnv): Record<Identity, string> {
  const addresses = {} as Record<Identity, string>;
  for (const identity of ["admin", "anson", "beatrice"] as const) {
    const envVar = `${identity.toUpperCase()}_ADDRESS`;
    const value = env[envVar];
    if (!value) {
      throw new Error(`Missing required env var ${envVar}`);
    }
    addresses[identity] = value;
  }
  return addresses;
}
