import * as dotenv from "dotenv";
import * as path from "path";
import { ChainService, loadPrivateKeysFromEnv } from "./chain/ChainService";
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

const chain = new ChainService(RPC_URL, loadPrivateKeysFromEnv(process.env), DEPLOYED_ADDRESSES_PATH);
const auditLog = new AuditLogRepository(DB_PATH);
const compliance = new ComplianceAdminService(chain);
const transferService = new TransferService(chain, auditLog);

const app = createServer({ chain, compliance, transferService, auditLog });

app.listen(PORT, () => {
  console.log(`backend-api listening on :${PORT}`);
});
