import { useState } from "react";
import { ApiClient, ApiError } from "../api/ApiClient";
import type { Identity } from "../api/ApiClient";

const ONBOARDABLE: { id: Identity; label: string }[] = [
  { id: "anson", label: "Anson" },
  { id: "beatrice", label: "Beatrice" },
];

interface IdentityState {
  message: string | null;
  isError: boolean;
  busy: boolean;
  mintAmount: string;
  balance: number | null;
}

const initialState: IdentityState = { message: null, isError: false, busy: false, mintAmount: "", balance: null };

/// Admin onboards identities without touching the CLI (DL-4.1, US-009):
/// register -> issue claim -> mint, one card per demo identity.
export function AdminPanel() {
  const [state, setState] = useState<Record<Identity, IdentityState>>({
    admin: { ...initialState },
    anson: { ...initialState },
    beatrice: { ...initialState },
  });

  function patch(id: Identity, patchValue: Partial<IdentityState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patchValue } }));
  }

  async function run(id: Identity, action: () => Promise<{ message: string; balance?: number }>) {
    patch(id, { busy: true, message: null, isError: false });
    try {
      const { message, balance } = await action();
      patch(id, { busy: false, message, isError: false, ...(balance !== undefined ? { balance } : {}) });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unexpected error — check the backend is running";
      patch(id, { busy: false, message, isError: true });
    }
  }

  return (
    <section aria-label="Admin panel">
      {ONBOARDABLE.map(({ id, label }) => {
        const identityState = state[id];
        return (
          <div key={id} className="card" data-testid={`admin-card-${id}`}>
            <h3>{label}</h3>
            <div className="button-row">
              <button
                type="button"
                disabled={identityState.busy}
                onClick={() => run(id, async () => ({ message: (await ApiClient.registerIdentity(id)).status }))}
              >
                Register {label}
              </button>
              <button
                type="button"
                disabled={identityState.busy}
                onClick={() => run(id, async () => ({ message: (await ApiClient.issueClaim(id)).status }))}
              >
                Issue Claim
              </button>
            </div>
            <div className="button-row">
              <input
                type="number"
                min={1}
                placeholder="Amount"
                value={identityState.mintAmount}
                onChange={(e) => patch(id, { mintAmount: e.target.value })}
                aria-label={`Mint amount for ${label}`}
              />
              <button
                type="button"
                disabled={identityState.busy || !identityState.mintAmount}
                onClick={() =>
                  run(id, async () => {
                    const result = await ApiClient.mint(id, Number(identityState.mintAmount));
                    return { message: result.status, balance: result.balance };
                  })
                }
              >
                Mint
              </button>
            </div>
            {identityState.balance !== null && <p className="balance">Balance: {identityState.balance} DAT</p>}
            {identityState.message && (
              <p role="status" className={identityState.isError ? "message error" : "message success"}>
                {identityState.isError ? identityState.message : `${identityState.message}`}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
