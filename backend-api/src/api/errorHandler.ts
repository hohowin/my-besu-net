import { NextFunction, Request, Response } from "express";
import { ComplianceRejectedError } from "../chain/errors";

/// FR-6: a compliance rejection surfaces as a readable 4xx, never a raw RPC
/// error or stack trace that could leak internals. Must be registered last
/// (after all routes) per Express error-middleware convention.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ComplianceRejectedError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
}
