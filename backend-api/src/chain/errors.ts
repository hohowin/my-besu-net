/// Surfaced through the API as a 4xx with a human-readable reason (FR-6,
/// US-007) — never a raw RPC error, which could leak internals.
export class ComplianceRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceRejectedError";
  }
}

/// ethers v6 decodes a standard `require(cond, "reason")` revert into
/// `error.reason` for both eth_call gas estimation and RPC providers that
/// return revert data (Besu does). Falls back to shortMessage/message
/// pattern-matching for anything that slips through with a differently
/// shaped error (e.g. a provider-level ProviderError wrapper).
export function extractRevertReason(err: unknown): string | null {
  if (err && typeof err === "object") {
    const e = err as { reason?: unknown; shortMessage?: unknown; message?: unknown };
    if (typeof e.reason === "string" && e.reason.length > 0) {
      return e.reason;
    }
    if (typeof e.shortMessage === "string" && e.shortMessage.length > 0) {
      return e.shortMessage;
    }
    if (typeof e.message === "string") {
      const quoted = e.message.match(/reverted with reason string '([^']+)'/);
      if (quoted) return quoted[1];
      const parenthesized = e.message.match(/execution reverted \(([^)]+)\)/i);
      if (parenthesized) return parenthesized[1];
      const inline = e.message.match(/execution reverted:?\s*([^"]+)/i);
      if (inline) return inline[1].trim();
    }
  }
  return null;
}

export function toComplianceError(err: unknown): Error {
  const reason = extractRevertReason(err);
  if (reason) {
    return new ComplianceRejectedError(reason);
  }
  return err instanceof Error ? err : new Error(String(err));
}
