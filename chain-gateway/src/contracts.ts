/// The two contracts this demo's application layer actually calls. A real
/// platform-as-a-service gateway introspects whatever ABI you give it —
/// this one does the same (see routes.ts's use of
/// ethers.Interface.getFunction(...).stateMutability to decide
/// GET-vs-POST), it just only has these two registered because that's all
/// the app needs.
export const CONTRACTS = {
  identityRegistry: [
    "function registerIdentity(address wallet)",
    "function issueClaim(address wallet, uint256 topic)",
    "function isVerified(address wallet) view returns (bool)",
    "function isRegistered(address wallet) view returns (bool)",
  ],
  token: [
    "function mint(address to, uint256 amount)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
  ],
} as const;

export type ContractInstance = keyof typeof CONTRACTS;

export function isContractInstance(value: string): value is ContractInstance {
  return value in CONTRACTS;
}
