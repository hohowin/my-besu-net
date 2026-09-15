/// Minimal ABI fragments for the Phase 2 contracts — only what backend-api
/// calls. Kept hand-written here rather than importing Hardhat artifacts so
/// this service has no build-time dependency on contracts/ (D-17 layering:
/// the coupling artifact between phases is deployed-addresses.json, not the
/// Hardhat toolchain).
export const IDENTITY_REGISTRY_ABI = [
  "function registerIdentity(address wallet)",
  "function issueClaim(address wallet, uint256 topic)",
  "function isVerified(address wallet) view returns (bool)",
  "function isRegistered(address wallet) view returns (bool)",
];

export const TOKEN_ABI = [
  "function mint(address to, uint256 amount)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];
