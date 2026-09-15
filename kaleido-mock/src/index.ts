import * as dotenv from "dotenv";
import * as path from "path";
import cors from "cors";
import express from "express";
import { ChainRegistry, loadPrivateKeysFromEnv } from "./chain";
import { ReceiptStore } from "./receipts";
import { createRouter, errorHandler } from "./routes";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const PORT = Number(process.env.PORT ?? 5001);
const RPC_URL = process.env.BESU_RPC_URL ?? "http://localhost:8545";
const DEPLOYED_ADDRESSES_PATH =
  process.env.DEPLOYED_ADDRESSES_PATH ?? path.join(__dirname, "..", "..", "deployed-addresses.json");

const chain = new ChainRegistry(RPC_URL, loadPrivateKeysFromEnv(process.env), DEPLOYED_ADDRESSES_PATH);
const receipts = new ReceiptStore();

const app = express();
app.use(cors());
app.use(express.json());
app.use(createRouter(chain, receipts));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`kaleido-mock gateway listening on :${PORT}`);
});
