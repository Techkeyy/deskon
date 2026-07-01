"use client";

import { useState } from "react";
import { connectWallet } from "@/lib/wallet";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AuthModal({
  open,
  onClose,
  onWalletConnected,
  title = "Sign in to Deskon",
  subtitle = "Connect a wallet to get paid, or continue with Google.",
}: {
  open: boolean;
  onClose: () => void;
  onWalletConnected: (address: string) => void;
  title?: string;
  subtitle?: string;
}) {
  const [busy, setBusy] = useState<"google" | "wallet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleWallet() {
    setError(null);
    setBusy("wallet");
    try {
      const address = await connectWallet();
      onWalletConnected(address);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy("google");
    try {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      // On success the browser redirects to Google; nothing more to do here.
    } catch (e: any) {
      setError(
        e.message?.includes("provider is not enabled")
          ? "Google sign-in isn't enabled yet — use a wallet for now."
          : e.message
      );
      setBusy(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 className="display" style={{ fontSize: 26, fontWeight: 600 }}>
              {title}
            </h2>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-3)",
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 26 }}>
          <button className="auth-option" onClick={handleGoogle} disabled={busy !== null}>
            <GoogleIcon />
            <span>{busy === "google" ? "Redirecting…" : "Continue with Google"}</span>
          </button>

          <button className="auth-option" onClick={handleWallet} disabled={busy !== null}>
            <WalletIcon />
            <span>{busy === "wallet" ? "Waiting for wallet…" : "Connect wallet"}</span>
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 16, fontSize: 13, color: "var(--accent-soft)" }}>{error}</p>
        )}

        <p style={{ marginTop: 20, fontSize: 12, lineHeight: 1.5, color: "var(--text-3)" }}>
          Connecting a wallet is how you get paid. Google is for signing in — you can add
          a payout wallet after.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" stroke="var(--text-1)" strokeWidth="1.6" />
      <path d="M16 12h2" stroke="var(--text-1)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.5 9.5h19" stroke="var(--text-1)" strokeWidth="1.6" />
    </svg>
  );
}
