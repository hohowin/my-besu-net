import { NextFunction, Request, Response, Router } from "express";
import { ChainServiceLike } from "../chain/ChainService";
import { ComplianceAdminService } from "../services/ComplianceAdminService";
import { TransferService } from "../services/TransferService";
import { AuditLogRepositoryLike } from "../db/AuditLogRepository";
import { isIdentity } from "../identities";

export interface RouterDeps {
  chain: ChainServiceLike;
  compliance: ComplianceAdminService;
  transferService: TransferService;
  auditLog: AuditLogRepositoryLike;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/// Thin adapter over the service layer (architecture.md §6): no chain calls,
/// no SQL, no business invariants here — only request validation and
/// shaping the 6-endpoint REST surface (US-008).
export function createRouter(deps: RouterDeps): Router {
  const { compliance, transferService, chain, auditLog } = deps;
  const router = Router();

  router.post("/admin/register-identity", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who } = req.body ?? {};
      if (!isIdentity(who)) {
        return res.status(400).json({ error: "who must be one of admin/anson/beatrice" });
      }
      res.json(await compliance.registerIdentity(who));
    } catch (err) {
      next(err);
    }
  });

  router.post("/admin/issue-claim", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who } = req.body ?? {};
      if (!isIdentity(who)) {
        return res.status(400).json({ error: "who must be one of admin/anson/beatrice" });
      }
      res.json(await compliance.issueClaim(who));
    } catch (err) {
      next(err);
    }
  });

  router.post("/admin/mint", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who, amount } = req.body ?? {};
      if (!isIdentity(who)) {
        return res.status(400).json({ error: "who must be one of admin/anson/beatrice" });
      }
      if (!isPositiveInteger(amount)) {
        return res.status(400).json({ error: "amount must be a positive integer" });
      }
      res.json(await compliance.mint(who, amount));
    } catch (err) {
      next(err);
    }
  });

  router.post("/transfer", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to, amount } = req.body ?? {};
      if (!isIdentity(from) || !isIdentity(to)) {
        return res.status(400).json({ error: "from/to must each be one of admin/anson/beatrice" });
      }
      if (!isPositiveInteger(amount)) {
        return res.status(400).json({ error: "amount must be a positive integer" });
      }
      res.json(await transferService.transfer(from, to, amount));
    } catch (err) {
      next(err);
    }
  });

  router.get("/balance/:who", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who } = req.params;
      if (!isIdentity(who)) {
        return res.status(400).json({ error: "unknown identity" });
      }
      const address = chain.getAddress(who);
      const balance: bigint = await chain.token().balanceOf(address);
      res.json({ who, balance: Number(balance) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/transfers", (_req: Request, res: Response) => {
    res.json(auditLog.listTransfers());
  });

  return router;
}
