import { NextFunction, Request, Response, Router } from "express";
import { ChainRegistry } from "./chain";
import { ReceiptStore } from "./receipts";
import { isContractInstance } from "./contracts";
import { isIdentity } from "./identities";
import { describeError } from "./errors";

function serializeOutput(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map(serializeOutput);
  return value;
}

/// The generic contract gateway — this is the actual "Kaleido pattern"
/// being demonstrated. Nothing here knows what "registering an identity"
/// or "minting" means; it only knows how to read an ABI and turn any
/// method into a REST call. All app-specific meaning stays in
/// backend-api's ComplianceAdminService/TransferService, same as it would
/// with a real Kaleido gateway.
export function createRouter(chain: ChainRegistry, receipts: ReceiptStore): Router {
  const router = Router();

  router.get("/contracts/:instance/:method", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instance, method } = req.params;
      if (!isContractInstance(instance)) {
        return res.status(404).json({ error: `unknown contract instance: ${instance}` });
      }
      const iface = chain.getInterface(instance);
      const fn = iface.getFunction(method);
      if (!fn) {
        return res.status(404).json({ error: `unknown method: ${method}` });
      }
      if (fn.stateMutability !== "view" && fn.stateMutability !== "pure") {
        return res.status(400).json({ error: `${method} is a state-changing method — use POST` });
      }

      const params = req.query.params ? JSON.parse(String(req.query.params)) : [];
      const contract = chain.getContract(instance, "admin"); // read-only call, signer identity is irrelevant
      const output = await contract[method](...params);
      res.json({ output: serializeOutput(output) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/contracts/:instance/:method", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instance, method } = req.params;
      if (!isContractInstance(instance)) {
        return res.status(404).json({ error: `unknown contract instance: ${instance}` });
      }
      const iface = chain.getInterface(instance);
      const fn = iface.getFunction(method);
      if (!fn) {
        return res.status(404).json({ error: `unknown method: ${method}` });
      }

      const { params = [], from } = req.body ?? {};

      if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
        const contract = chain.getContract(instance, "admin");
        const output = await contract[method](...params);
        return res.json({ output: serializeOutput(output) });
      }

      if (!isIdentity(from)) {
        return res.status(400).json({ error: "from must be one of admin/anson/beatrice" });
      }

      const contract = chain.getContract(instance, from);
      let tx: import("ethers").ContractTransactionResponse;
      try {
        tx = await contract[method](...params);
      } catch (err) {
        // Reverted during gas estimation — nothing was ever broadcast, so
        // there's no receipt to poll. Fail the request synchronously,
        // matching how Kaleido itself rejects a call it can't even submit.
        chain.resetNonce(from);
        return res.status(400).json({ error: describeError(err) });
      }

      receipts.createPending(tx.hash);
      res.status(202).json({ id: tx.hash, status: "submitted" });

      // Fire-and-forget: resolve the receipt in the background once mined.
      // tx.wait() (unlike provider.waitForTransaction) attempts a replay
      // call to decode the revert reason when the receipt status is 0.
      tx.wait()
        .then((receipt) => {
          if (!receipt) {
            receipts.resolveError(tx.hash, "transaction dropped from mempool");
          } else {
            receipts.resolveSuccess(tx.hash, receipt.blockNumber);
          }
        })
        .catch((err) => {
          chain.resetNonce(from);
          receipts.resolveError(tx.hash, describeError(err));
        });
    } catch (err) {
      next(err);
    }
  });

  router.get("/receipts/:id", (req: Request, res: Response) => {
    const receipt = receipts.get(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: "unknown receipt id" });
    }
    res.json(receipt);
  });

  return router;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(500).json({ error: "internal gateway error" });
}
