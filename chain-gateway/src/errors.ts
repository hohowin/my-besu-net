/// Same extraction logic as backend-api/src/chain/errors.ts — duplicated
/// rather than shared across services on purpose (D-17: no cross-service
/// coupling beyond the REST/JSON-RPC boundaries already in play; a shared
/// package would be over-engineering for two small demo services).
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

export function describeError(err: unknown): string {
  return extractRevertReason(err) ?? (err instanceof Error ? err.message : String(err));
}
