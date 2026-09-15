#!/usr/bin/env node
// One-time admin onboarding + mint (README "Getting Started" step 4;
// docs/deliverables.md DL-4.3 step 3). Besu has no persistent chain volume
// in docker-compose.yml (D-15/D-16: solo local PoC, not meant to survive a
// teardown) — every `docker compose down` wipes it back to genesis — so
// this always redeploys fresh contracts rather than trusting a possibly
// stale deployed-addresses.json, then restarts backend-api so its
// ChainService (which reads that file once, at process start) picks up the
// new addresses instead of holding stale ones from before the reset.

const { execSync } = require("child_process");
const path = require("path");

const BESU_RPC_URL = "http://localhost:8545";
const BACKEND_URL = "http://localhost:4000";
const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilOk(label, check, tries = 30, delayMs = 2000) {
  for (let i = 0; i < tries; i++) {
    try {
      if (await check()) return;
    } catch {
      // not ready yet — retry
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} did not become ready after ${tries} attempts`);
}

async function api(path_, body) {
  const res = await fetch(`${BACKEND_URL}${path_}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path_} failed: ${json.error ?? res.status}`);
  }
  return json;
}

async function main() {
  console.log("1. Waiting for Besu RPC...");
  await waitUntilOk("Besu RPC", async () => {
    const res = await fetch(BESU_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
    });
    return res.ok;
  });

  console.log("2. Deploying contracts (always fresh)...");
  run("npm run deploy:besu", { cwd: CONTRACTS_DIR });

  console.log("3. Restarting backend-api so it picks up the freshly deployed addresses...");
  try {
    run("docker compose restart backend-api");
  } catch {
    console.log(
      "   (docker compose restart failed — if you're running backend-api via `npm run dev` instead of the container, just restart it manually)",
    );
  }

  console.log("4. Waiting for backend-api...");
  await waitUntilOk("backend-api", async () => (await fetch(`${BACKEND_URL}/transfers`)).ok);

  console.log("5. Onboarding Anson and Beatrice, minting a starting balance...");
  for (const who of ["anson", "beatrice"]) {
    await api("/admin/register-identity", { who });
    await api("/admin/issue-claim", { who });
  }
  await api("/admin/mint", { who: "anson", amount: 1000 });

  console.log("Seed complete — Anson has 1000 DAT, Beatrice is verified with 0 DAT.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
