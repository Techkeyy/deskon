"use client";

import { useState } from "react";
import Link from "next/link";
import {
  connectWallet,
  signMessage,
  dashboardAuthMessage,
} from "@/lib/wallet";
import { Order, SellerLedger, Withdrawal } from "@/types";

interface DashData {
  seller: { displayName: string; slug: string; payoutWallet: string };
  ledger: SellerLedger;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashData | null>(null);

  async function authenticate() {
    const wallet = await connectWallet();
    const message = dashboardAuthMessage(wallet);
    const signature = await signMessage(wallet, message);
    return { wallet, message, signature };
  }

  async function connect() {
    setError(null);
    setLoading(true);
    try {
      const creds = await authenticate();
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function withdraw() {
    if (!data || data.ledger.available <= 0) return;
    setWithdrawing(true);
    setError(null);
    try {
      const creds = await authenticate();
      const res = await fetch("/api/dashboard/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...creds, amount: data.ledger.available }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      const refreshed = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      setData(await refreshed.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav
        style={{
          height: "var(--nav-h)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href="/">
          <span className="display" style={{ fontSize: 19, fontWeight: 700 }}>
            Deskon
          </span>
        </Link>
        <span className="eyebrow">Seller dashboard</span>
      </nav>

      <main
        style={{
          flex: 1,
          maxWidth: 860,
          width: "100%",
          margin: "0 auto",
          padding: "56px 32px",
        }}
      >
        {!data ? (
          <div style={{ maxWidth: 440 }}>
            <p className="eyebrow">Your earnings</p>
            <h1
              className="display"
              style={{ fontSize: "clamp(30px, 5vw, 44px)", marginTop: 14 }}
            >
              Connect to see what your closer collected.
            </h1>
            <p
              style={{
                marginTop: 18,
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--text-2)",
              }}
            >
              Connect the wallet you set up your Relay with. You&apos;ll sign a
              message to prove it&apos;s yours — no transaction, no gas.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 32 }}
              onClick={connect}
              disabled={loading}
            >
              {loading ? "Waiting for wallet…" : "Connect wallet"}
            </button>
            {error && (
              <p style={{ marginTop: 18, fontSize: 14, color: "var(--accent-soft)" }}>
                {error}
              </p>
            )}
          </div>
        ) : (
          <Ledger
            data={data}
            onWithdraw={withdraw}
            withdrawing={withdrawing}
            error={error}
          />
        )}
      </main>
    </div>
  );
}

function Ledger({
  data,
  onWithdraw,
  withdrawing,
  error,
}: {
  data: DashData;
  onWithdraw: () => void;
  withdrawing: boolean;
  error: string | null;
}) {
  const { seller, ledger } = data;
  return (
    <div>
      <p className="eyebrow">{seller.displayName}</p>
      <h1 className="display" style={{ fontSize: "clamp(28px, 4vw, 40px)", marginTop: 12 }}>
        Earnings
      </h1>

      {/* Stat cards */}
      <div
        style={{
          marginTop: 36,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 1,
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <Stat label="Collected" value={ledger.collected} accent />
        <Stat label="Pending" value={ledger.pending} />
        <Stat label="Available" value={ledger.available} />
      </div>

      {/* Withdraw */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={onWithdraw}
          disabled={withdrawing || ledger.available <= 0}
        >
          {withdrawing
            ? "Requesting…"
            : ledger.available > 0
            ? `Withdraw $${ledger.available} to your wallet`
            : "Nothing to withdraw"}
        </button>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
          → {seller.payoutWallet.slice(0, 6)}…{seller.payoutWallet.slice(-4)}
        </span>
      </div>
      {error && (
        <p style={{ marginTop: 14, fontSize: 14, color: "var(--accent-soft)" }}>
          {error}
        </p>
      )}

      {/* Jobs */}
      <h2 className="eyebrow" style={{ marginTop: 48 }}>
        Jobs
      </h2>
      <div
        style={{
          marginTop: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {ledger.orders.length === 0 ? (
          <div style={{ padding: "28px 22px", color: "var(--text-3)", fontSize: 14 }}>
            No deals closed yet. Share your Relay link to get started.
          </div>
        ) : (
          ledger.orders.map((o, i) => <JobRow key={o.id} order={o} first={i === 0} />)
        )}
      </div>

      {/* Withdrawal history */}
      {ledger.withdrawals.length > 0 && (
        <>
          <h2 className="eyebrow" style={{ marginTop: 40 }}>
            Withdrawals
          </h2>
          <div
            style={{
              marginTop: 16,
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {ledger.withdrawals.map((w, i) => (
              <WithdrawalRow key={w.id} w={w} first={i === 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div style={{ background: "var(--bg)", padding: "24px 22px" }}>
      <span className="eyebrow">{label}</span>
      <div
        className="num"
        style={{
          fontSize: 30,
          fontWeight: 500,
          marginTop: 10,
          color: accent ? "var(--accent-soft)" : "var(--text-1)",
        }}
      >
        ${value}
        <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 6 }}>
          USDC
        </span>
      </div>
    </div>
  );
}

function JobRow({ order, first }: { order: Order; first: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 22px",
        borderTop: first ? "none" : "1px solid var(--border)",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: "var(--text-1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {order.scope || "Deal"}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          {new Date(order.createdAt).toLocaleDateString()} · {order.status}
        </div>
      </div>
      <span className="num" style={{ fontSize: 16, color: "var(--text-1)" }}>
        ${order.amount}
      </span>
    </div>
  );
}

function WithdrawalRow({ w, first }: { w: Withdrawal; first: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 22px",
        borderTop: first ? "none" : "1px solid var(--border)",
      }}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
        {new Date(w.createdAt).toLocaleDateString()} · {w.status}
      </div>
      <span className="num" style={{ fontSize: 15, color: "var(--text-2)" }}>
        −${w.amount}
      </span>
    </div>
  );
}
