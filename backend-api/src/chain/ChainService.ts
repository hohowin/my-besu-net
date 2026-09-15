import { ethers } from "ethers";
import * as fs from "fs";
import { Identity, IDENTITIES } from "../identities";
import { IDENTITY_REGISTRY_ABI, TOKEN_ABI } from "./abi";

interface DeployedAddresses {
  identityRegistry: string;
  token: string;
}

/// Narrow surface the service layer depends on, so tests can supply a fake
/// without touching a real provider or private keys.
export interface ChainServiceLike {
  getAddress(identity: Identity): string;
  identityRegistry(asIdentity?: Identity): ethers.Contract;
  token(asIdentity?: Identity): ethers.Contract;
  resetNonce(identity: Identity): void;
}

/// The one place demo private keys are handled (D-09, FR-8). Every other
/// backend module gets an ethers Contract instance already bound to a
/// signer — it never sees a private key or raw signer, only an Identity
/// label. Deploy addresses are read from Phase 2's deployed-addresses.json,
/// the coupling artifact between the contracts and backend phases
/// (architecture.md §5).
export class ChainService implements ChainServiceLike {
  private readonly provider: ethers.JsonRpcProvider;
  // NonceManager tracks each identity's nonce in-process after every send,
  // rather than re-querying the node's "pending" transaction count on every
  // call — plain Wallets raced here: two admin-signed sends close together
  // (e.g. register -> issueClaim -> mint in the same onboarding flow) could
  // both read the same "pending" nonce from Besu and one would fail with
  // "nonce has already been used". Wrapping in NonceManager is ethers v6's
  // built-in fix for exactly this, rather than a hand-rolled queue.
  private readonly signers: Record<Identity, ethers.NonceManager>;
  private readonly walletAddresses: Record<Identity, string>;
  private readonly addresses: DeployedAddresses;

  constructor(rpcUrl: string, privateKeys: Record<Identity, string>, deployedAddressesPath: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallets: Record<Identity, ethers.Wallet> = {
      admin: new ethers.Wallet(privateKeys.admin, this.provider),
      anson: new ethers.Wallet(privateKeys.anson, this.provider),
      beatrice: new ethers.Wallet(privateKeys.beatrice, this.provider),
    };
    this.walletAddresses = {
      admin: wallets.admin.address,
      anson: wallets.anson.address,
      beatrice: wallets.beatrice.address,
    };
    this.signers = {
      admin: new ethers.NonceManager(wallets.admin),
      anson: new ethers.NonceManager(wallets.anson),
      beatrice: new ethers.NonceManager(wallets.beatrice),
    };

    if (!fs.existsSync(deployedAddressesPath)) {
      throw new Error(
        `deployed-addresses.json not found at ${deployedAddressesPath} — run \`npm run deploy:besu\` in contracts/ first`,
      );
    }
    this.addresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"));
  }

  getAddress(identity: Identity): string {
    return this.walletAddresses[identity];
  }

  identityRegistry(asIdentity: Identity = "admin"): ethers.Contract {
    return new ethers.Contract(this.addresses.identityRegistry, IDENTITY_REGISTRY_ABI, this.signers[asIdentity]);
  }

  token(asIdentity: Identity = "admin"): ethers.Contract {
    return new ethers.Contract(this.addresses.token, TOKEN_ABI, this.signers[asIdentity]);
  }

  /// NonceManager reserves a nonce while populating a transaction (before
  /// eth_estimateGas even runs) and never rolls it back if that estimate
  /// reverts — since no transaction was ever broadcast, nothing on-chain
  /// consumed that nonce, so NonceManager's local cache is left one ahead of
  /// reality. Every later send from that identity then sits pending forever,
  /// waiting for a nonce that will never arrive. Call this after any failed
  /// send so the next one re-syncs against the chain's real pending nonce.
  resetNonce(identity: Identity): void {
    this.signers[identity].reset();
  }
}

export function loadPrivateKeysFromEnv(env: NodeJS.ProcessEnv): Record<Identity, string> {
  const keys = {} as Record<Identity, string>;
  for (const identity of IDENTITIES) {
    const envVar = `${identity.toUpperCase()}_PRIVATE_KEY`;
    const value = env[envVar];
    if (!value) {
      throw new Error(`Missing required env var ${envVar}`);
    }
    keys[identity] = value;
  }
  return keys;
}
