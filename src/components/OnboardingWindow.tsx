"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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
        "Let's build your closer. No forms — just tell me about your work and I'll wire it up.\n\nTo start: **what do you do?**",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [relayLink, setRelayLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, relayLink, loading]);

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
        body: JSON.stringify({ messages: updated }),
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
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          D
        </span>
        <div style={{ lineHeight: 1.3 }}>
          <div className="display" style={{ fontSize: 15, fontWeight: 700 }}>
            Set up your Relay
          </div>
          <div className="eyebrow" style={{ fontSize: 9 }}>
            Deskon onboarding
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        className="scroll-thin"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent:
                msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "12px 16px",
                borderRadius: 14,
                fontSize: 14.5,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                ...(msg.role === "user"
                  ? { background: "var(--accent)", color: "#fff" }
                  : {
                      background: "var(--surface)",
                      color: "var(--text-2)",
                      border: "1px solid var(--border)",
                    }),
              }}
            >
              {renderContent(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "14px 16px",
                display: "flex",
                gap: 5,
              }}
            >
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
            <a
              href={relayLink}
              target="_blank"
              rel="noreferrer"
              className="navlink"
              style={{
                display: "inline-block",
                marginTop: 14,
                color: "var(--accent-soft)",
              }}
            >
              Preview your Relay →
            </a>
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
            gap: 10,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer…"
            disabled={loading}
            style={{
              flex: 1,
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14.5,
              color: "var(--text-1)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
