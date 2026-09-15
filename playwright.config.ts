import { defineConfig, devices } from "@playwright/test";

/// D-13: 3 specs against the full running stack. Does NOT auto-start
/// docker compose or the frontend dev server — Besu + backend-api +
/// frontend must already be up (see docs/deliverables.md DL-4.3 "How to
/// try it"), since the E2E suite proves the already-running stack works,
/// not that it can be started.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  // All 3 specs mutate the same real chain state through the same Admin
  // signer (ChainService owns one nonce sequence per identity) — running
  // spec files in parallel workers races on that nonce. Force full
  // serialization instead of just within-file (fullyParallel: false alone
  // doesn't stop separate files from running concurrently in separate workers).
  workers: 1,
  retries: 0,
  reporter: "html",
  // Every admin/transfer action waits for a real Besu block to confirm the
  // underlying transaction before the API responds — plain DOM-interaction
  // timeouts are too tight for that.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    // The containerized frontend (docker-compose.yml, nginx serving the
    // production build) — matches docs/deliverables.md's documented flow
    // (docker compose up -d && npm run seed && npx playwright test), not
    // the :5173 Vite dev server used during local iteration.
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
