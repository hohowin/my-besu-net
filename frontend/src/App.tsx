import { useState } from "react";
import { AdminPanel } from "./components/AdminPanel";
import { TransferDashboard } from "./components/TransferDashboard";
import "./App.css";

type Tab = "admin" | "transfer";

export function App() {
  const [tab, setTab] = useState<Tab>("admin");

  return (
    <main>
      <h1>besu-digital-asset-demo</h1>
      <nav className="tabs">
        <button type="button" className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
          Admin
        </button>
        <button type="button" className={tab === "transfer" ? "active" : ""} onClick={() => setTab("transfer")}>
          Transfer
        </button>
      </nav>
      {tab === "admin" ? <AdminPanel /> : <TransferDashboard />}
    </main>
  );
}

export default App;
