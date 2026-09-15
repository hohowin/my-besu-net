import { ethers } from "ethers";
import * as fs from "fs";
import { Identity, IDENTITIES } from "./identities";
import { CONTRACTS, ContractInstance } from "./contracts";

interface DeployedAddresses {
  identityRegistry: string;
  token: string;
}

/// The mimic's key custody model matches how Kaleido actually works: your
/// application never holds signing keys — the gateway/console does, and
/// your app only ever sees addresses and REST calls. (This is a genuine
/// architectural difference from backend-api's own ChainService, where the
/// app process itself holds the keys — D-09. Here, custody has moved to
/// this middleware, which is the point of the demo.)
export class ChainRegistry {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signers: Record<Identity, ethers.NonceManager>;
  private readonly walletAddresses: Record<Identity, string>;
  private readonly addresses: DeployedAddresses;
  private readonly interfaces: Record<ContractInstance, ethers.Interface>;

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
    // NonceManager, not a plain Wallet — see resetNonce() below for why.
    this.signers = {
      admin: new ethers.NonceManager(wallets.admin),
      anson: new ethers.NonceManager(wallets.anson),
      beatrice: new ethers.NonceManager(wallets.beatrice),
    };

    if (!fs.existsSync(deployedAddressesPath)) {
      throw new Error(`deployed-addresses.json not found at ${deployedAddressesPath}`);
    }
    this.addresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"));

    this.interfaces = {
      identityRegistry: new ethers.Interface(CONTRACTS.identityRegistry),
      token: new ethers.Interface(CONTRACTS.token),
    };
  }

  getAddress(identity: Identity): string {
    return this.walletAddresses[identity];
  }

  getInterface(instance: ContractInstance): ethers.Interface {
    return this.interfaces[instance];
  }

  /// `asIdentity` decides who signs — irrelevant for a view/pure call, but
  /// every write goes through this contract instance's own signer, per the
  /// generic gateway pattern (routes.ts passes `from` straight through here).
  getContract(instance: ContractInstance, asIdentity: Identity): ethers.Contract {
    return new ethers.Contract(this.addresses[instance], CONTRACTS[instance], this.signers[asIdentity]);
  }

  /// NonceManager reserves a nonce while populating a transaction and never
  /// rolls it back if eth_estimateGas reverts (nothing was ever broadcast,
  /// so nothing on-chain actually consumed it) — the exact bug found and
  /// fixed in backend-api/src/chain/ChainService.ts during Phase 4. Same
  /// fix needed here since this service now does the same job.
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
