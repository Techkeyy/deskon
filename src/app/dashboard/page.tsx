"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { connectWallet, signMessage, dashboardAuthMessage } from "@/lib/wallet";
import { getGoogleSession, googleSignOut } from "@/lib/supabase-browser";
import AuthModal from "@/components/AuthModal";
import { Order, SellerLedger, Withdrawal } from "@/types";

interface DashData {
  seller: {
    displayName: string;
    slug: string;
    payoutWallet: string;
    authEmail: string | null;
  };
  ledger: SellerLedger;
}

// Credentials sent to the API — either a wallet signature or a Google token.
type Creds =
  | { wallet: string; message: string; signature: string }
  | { googleToken: string };

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashData | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  // How we authed this session — so withdraw can re-auth the same way.
  const [creds, setCreds] = useState<Creds | null>(null);

  async function walletCreds(addr?: string): Promise<Creds> {
    const wallet = addr ?? (await connectWallet());
    const message = dashboardAuthMessage(wallet);
    const signature = await signMessage(wallet, message);
    return { wallet, message, signature };
  }

  const load = useCallback(async (c: Creds) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setCreds(c);
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Returning from a Google redirect? Load straight into the dashboard.
  useEffect(() => {
    (async () => {
      const g = await getGoogleSession();
      if (g) await load({ googleToken: g.token });
      setCheckingGoogle(false);
    })();
  }, [load]);

  async function loadWithWallet(addr?: string) {
    try {
      const c = await walletCreds(addr);
      await load(c);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function signOut() {
    if (creds && "googleToken" in creds) await googleSignOut();
    setData(null);
    setCreds(null);
    setError(null);
  }

  async function withdraw() {
    if (!data || data.ledger.available <= 0) return;
    setWithdrawing(true);
    setError(null);
    try {
      // Reuse Google creds if that's how we logged in; else re-sign with wallet.
      let c: Creds;
      if (creds && "googleToken" in creds) {
        const g = await getGoogleSession();
        c = g ? { googleToken: g.token } : creds;
      } else {
        c = await walletCreds();
      }
      const res = await fetch("/api/dashboard/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, amount: data.ledger.available }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      await load(c);
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
        {data ? (
          <button className="navlink" onClick={signOut}>
            Sign out
          </button>
        ) : (
          <span className="eyebrow">Seller dashboard</span>
        )}
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
              {checkingGoogle
                ? "Opening your dashboard…"
                : "Connect to see what your closer collected."}
            </h1>
            <p
              style={{
                marginTop: 18,
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--text-2)",
              }}
            >
              Sign in with the wallet your Relay is bound to, or with the Google
              account you linked at setup. Wallet sign-in asks for a signature —
              no transaction, no gas.
            </p>
            {!checkingGoogle && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 32 }}
                onClick={() => setAuthOpen(true)}
                disabled={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            )}
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

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onWalletConnected={(a) => loadWithWallet(a)}
        title="Open your dashboard"
        subtitle="Connect the wallet your Relay is bound to, or continue with the Google account you linked at setup."
      />
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
