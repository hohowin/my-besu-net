export type ReceiptStatus = "pending" | "success" | "error";

export interface Receipt {
  id: string;
  status: ReceiptStatus;
  transactionHash?: string;
  blockNumber?: number;
  error?: string;
}

/// The defining Kaleido pattern this mimic exists to demonstrate: a write
/// call doesn't block on confirmation. It returns a receipt id immediately
/// (id = the transaction hash, once broadcast — already a unique on-chain
/// reference, so no separate id scheme is needed), and the caller polls
/// GET /receipts/:id until it settles. In-memory only: this is a demo
/// middleware, not a durable job queue, and state resets with the process
/// (consistent with Besu itself having no persistent volume here either —
/// see docker-compose.kaleido.yml / D-15/D-16).
export class ReceiptStore {
  private readonly receipts = new Map<string, Receipt>();

  createPending(id: string): void {
    this.receipts.set(id, { id, status: "pending" });
  }

  resolveSuccess(id: string, blockNumber: number): void {
    this.receipts.set(id, { id, status: "success", transactionHash: id, blockNumber });
  }

  resolveError(id: string, error: string): void {
    this.receipts.set(id, { id, status: "error", transactionHash: id, error });
  }

  get(id: string): Receipt | undefined {
    return this.receipts.get(id);
  }
}
