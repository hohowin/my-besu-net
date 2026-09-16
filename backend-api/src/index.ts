import * as dotenv from "dotenv";
import * as path from "path";
import { ChainService, ChainServiceLike, loadPrivateKeysFromEnv } from "./chain/ChainService";
import { GatewayChainService, loadWalletAddressesFromEnv } from "./chain/GatewayChainService";
import { ComplianceAdminService } from "./services/ComplianceAdminService";
import { TransferService } from "./services/TransferService";
import { AuditLogRepository } from "./db/AuditLogRepository";
import { createServer } from "./api/server";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const PORT = Number(process.env.PORT ?? 4000);
const RPC_URL = process.env.BESU_RPC_URL ?? "http://localhost:8545";
// Overridable so the container can mount these at container-local paths
// instead of reaching outside its build context (docker-compose.yml).
const DEPLOYED_ADDRESSES_PATH =
  process.env.DEPLOYED_ADDRESSES_PATH ?? path.join(__dirname, "..", "..", "deployed-addresses.json");
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "transfers.db");

// "direct" (default): this process holds keys and talks to besu-rpc via
// ethers.js directly (D-09, the documented Phase 1-4 architecture).
// "gateway": routes through chain-gateway instead — a generic ABI-driven
// REST gateway with an async-receipt pattern (see chain-gateway/,
// docker-compose.gateway.yml). Everything downstream of ChainServiceLike
// (ComplianceAdminService, TransferService, the 6 REST routes) is
// identical either way; only the transport changes.
const CHAIN_TRANSPORT = process.env.CHAIN_TRANSPORT ?? "direct";

const chain: ChainServiceLike =
  CHAIN_TRANSPORT === "gateway"
    ? new GatewayChainService(
        process.env.CHAIN_GATEWAY_URL ?? "http://localhost:5001",
        loadWalletAddressesFromEnv(process.env),
      )
    : new ChainService(RPC_URL, loadPrivateKeysFromEnv(process.env), DEPLOYED_ADDRESSES_PATH);

console.log(`chain transport: ${CHAIN_TRANSPORT}`);

const auditLog = new AuditLogRepository(DB_PATH);
const compliance = new ComplianceAdminService(chain);
const transferService = new TransferService(chain, auditLog);

const app = createServer({ chain, compliance, transferService, auditLog });

app.listen(PORT, () => {
  console.log(`backend-api listening on :${PORT}`);
});
