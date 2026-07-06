"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import { getGoogleSession } from "@/lib/supabase-browser";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// The Google OAuth redirect reloads this page, so keep the in-progress
// conversation (and connected wallet) alive across it.
const DRAFT_KEY = "deskon:onboarding-draft";

function renderContent(content: string) {
  return content.split(/(\*\*.*?\*\*)/).map((part, j) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={j} style={{ color: "var(--text-1)", fontWeight: 600 }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={j}>{part}</span>
    )
  );
}

export default function OnboardingWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Let's build your closer. No forms — just tell me about your work and I'll wire it up. When you're ready, **connect your payout wallet** (top right) so I know where your earnings go.\n\nTo start: **what do you do?**",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [relayLink, setRelayLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, relayLink, loading]);

  // On mount: restore any draft saved before a Google redirect, then adopt the
  // Google email if the browser now has a session. All state updates happen
  // asynchronously to avoid cascading renders during mount.
  useEffect(() => {
    (async () => {
      const g = await getGoogleSession();
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          if (Array.isArray(draft.messages) && draft.messages.length > 1) {
            setMessages(draft.messages);
          }
          if (draft.wallet) setWallet(draft.wallet);
        }
      } catch {
        /* ignore malformed draft */
      }
      if (g) setEmail(g.email);
      setRestored(true);
    })();
  }, []);

  // Persist the draft so the Google redirect doesn't wipe the conversation.
  useEffect(() => {
    if (!restored || relayLink) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ messages, wallet }));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [messages, wallet, restored, relayLink]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || relayLink) return;

    const userMessage = input.trim();
    setInput("");
    const updated = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          payoutWallet: wallet,
          // The server derives the linked email from the verified session
          // token — the email string here is display-only.
          googleToken: (await getGoogleSession())?.token ?? null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Try again." },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      if (data.finalized && data.slug) {
        setRelayLink(`${window.location.origin}/chat/${data.slug}`);
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!relayLink) return;
    navigator.clipboard.writeText(relayLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        maxWidth: 640,
        margin: "0 auto",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 22px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href="/" className="back-btn" aria-label="Back to home">
          ←
        </Link>
        <Link href="/">
          <span className="display" style={{ fontSize: 19, fontWeight: 700 }}>
            Deskon
          </span>
        </Link>
        <span
          aria-hidden="true"
          style={{ width: 1, height: 16, background: "var(--border-strong)" }}
        />
        <span className="eyebrow" style={{ fontSize: 9.5 }}>
          Set up your Relay
        </span>

        {!relayLink && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {wallet && (
              <span className="badge" title="Payout wallet">
                <span className="badge-dot" />
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--accent-soft)" }}
                >
                  {wallet.slice(0, 6)}…{wallet.slice(-4)}
                </span>
              </span>
            )}
            {email && !wallet && (
              <span className="badge" title="Linked Google account">
                <span className="badge-dot" />
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--accent-soft)" }}
                >
                  {email}
                </span>
              </span>
            )}
            {!wallet && (
              <button className="btn btn-ghost" onClick={() => setAuthOpen(true)}>
                {email ? "Add wallet" : "Sign in"}
              </button>
            )}
          </div>
        )}
      </header>

      {/* Messages — typeset transcript, no bubbles */}
      <div
        className="scroll-thin"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "18px 26px 24px",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`t-msg${msg.role === "user" ? " t-msg-user" : ""}`}
          >
            <span
              className="t-who"
              style={
                msg.role === "user"
                  ? { color: "var(--accent-soft)" }
                  : undefined
              }
            >
              {msg.role === "user" ? "You" : "Deskon"}
            </span>
            <div className="t-body">{renderContent(msg.content)}</div>
          </div>
        ))}

        {loading && (
          <div className="t-msg" style={{ borderBottom: "none" }}>
            <span className="t-who">Deskon</span>
            <div style={{ display: "flex", gap: 5, paddingTop: 6 }}>
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}

        {relayLink && (
          <div
            style={{
              border: "1px solid var(--accent-border)",
              background: "var(--accent-dim)",
              borderRadius: 14,
              padding: "26px 24px",
            }}
          >
            <span className="eyebrow" style={{ color: "var(--accent-soft)" }}>
              Your Relay is live
            </span>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 16,
                alignItems: "center",
              }}
            >
              <code
                className="mono"
                style={{
                  flex: 1,
                  background: "var(--bg)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  padding: "11px 14px",
                  fontSize: 13,
                  color: "var(--text-1)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {relayLink}
              </code>
              <button
                onClick={copyLink}
                className="btn btn-primary"
                style={{ flexShrink: 0 }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p
              style={{
                marginTop: 16,
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--text-2)",
              }}
            >
              Share it anywhere — bio, DM, a post. Anyone who opens it talks to
              your closer, which scopes the deal and settles payment on-chain.
            </p>
            <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
              <a
                href={relayLink}
                target="_blank"
                rel="noreferrer"
                className="navlink"
                style={{ color: "var(--accent-soft)" }}
              >
                Preview your Relay →
              </a>
              <a
                href="/dashboard"
                className="navlink"
                style={{ color: "var(--text-2)" }}
              >
                Track earnings →
              </a>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!relayLink && (
        <form
          onSubmit={sendMessage}
          style={{
            padding: "14px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <input
              type="text"
              className="line-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </form>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onWalletConnected={(a) => setWallet(a)}
        title="Connect to get paid"
        subtitle="Connect your Base wallet so earnings reach you — or continue with Google."
      />
    </div>
  );
}
