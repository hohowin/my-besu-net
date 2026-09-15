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
}

/// The one place demo private keys are handled (D-09, FR-8). Every other
/// backend module gets an ethers Contract instance already bound to a
/// signer — it never sees a private key or raw signer, only an Identity
/// label. Deploy addresses are read from Phase 2's deployed-addresses.json,
/// the coupling artifact between the contracts and backend phases
/// (architecture.md §5).
export class ChainService implements ChainServiceLike {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signers: Record<Identity, ethers.Wallet>;
  private readonly addresses: DeployedAddresses;

  constructor(rpcUrl: string, privateKeys: Record<Identity, string>, deployedAddressesPath: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signers = {
      admin: new ethers.Wallet(privateKeys.admin, this.provider),
      anson: new ethers.Wallet(privateKeys.anson, this.provider),
      beatrice: new ethers.Wallet(privateKeys.beatrice, this.provider),
    };

    if (!fs.existsSync(deployedAddressesPath)) {
      throw new Error(
        `deployed-addresses.json not found at ${deployedAddressesPath} — run \`npm run deploy:besu\` in contracts/ first`,
      );
    }
    this.addresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"));
  }

  getAddress(identity: Identity): string {
    return this.signers[identity].address;
  }

  identityRegistry(asIdentity: Identity = "admin"): ethers.Contract {
    return new ethers.Contract(this.addresses.identityRegistry, IDENTITY_REGISTRY_ABI, this.signers[asIdentity]);
  }

  token(asIdentity: Identity = "admin"): ethers.Contract {
    return new ethers.Contract(this.addresses.token, TOKEN_ABI, this.signers[asIdentity]);
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
