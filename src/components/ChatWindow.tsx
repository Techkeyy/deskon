"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  metadata?: {
    type?: string;
    amount?: number;
  };
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

export default function ChatWindow({
  slug,
  sellerName,
}: {
  slug: string;
  sellerName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [paying, setPaying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `I'm the closer for **${sellerName}**. I handle the inquiry, scope the work, and settle payment — so ${sellerName} can stay on the work.\n\nWhat are you after?`,
      },
    ]);
  }, [sellerName]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, conversationId, message: userMessage }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Try again." },
        ]);
        return;
      }

      setConversationId(data.conversationId);
      setStatus(data.status);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          metadata: data.functionCall
            ? {
                type: data.functionCall.name,
                amount:
                  data.functionCall.args?.amount ||
                  data.functionCall.args?.price,
              }
            : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(amount: number) {
    if (!conversationId || paying) return;
    setPaying(true);

    try {
      const res = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();

      if (data.ok) {
        setStatus("completed");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Payment cleared. Your order is locked in escrow on Base — ${sellerName} will reach out to start the work.`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Payment could not be completed.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Payment connection error." },
      ]);
    } finally {
      setPaying(false);
    }
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
          {sellerName.charAt(0).toUpperCase()}
        </span>
        <div style={{ lineHeight: 1.3 }}>
          <div
            className="display"
            style={{ fontSize: 15, fontWeight: 700 }}
          >
            {sellerName}
          </div>
          <div className="eyebrow" style={{ fontSize: 9 }}>
            Closing via Deskon
          </div>
        </div>
        {status === "payment_pending" && (
          <span className="badge" style={{ marginLeft: "auto" }}>
            <span className="badge-dot" />
            <span
              className="num"
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--accent-soft)",
              }}
            >
              Deal on the table
            </span>
          </span>
        )}
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
              <div>{renderContent(msg.content)}</div>

              {msg.metadata?.type === "payment_prompt" &&
                msg.metadata.amount && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 12,
                      }}
                    >
                      <span className="eyebrow">Agreed</span>
                      <span
                        className="num"
                        style={{
                          fontSize: 22,
                          color: "var(--text-1)",
                          fontWeight: 500,
                        }}
                      >
                        ${msg.metadata.amount}{" "}
                        <span
                          style={{ fontSize: 12, color: "var(--text-3)" }}
                        >
                          USDC
                        </span>
                      </span>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => handlePay(msg.metadata!.amount!)}
                      disabled={paying || status === "completed"}
                    >
                      {paying
                        ? "Settling on Base…"
                        : status === "completed"
                        ? "Paid ✓"
                        : `Pay $${msg.metadata.amount} on Base`}
                    </button>
                  </div>
                )}
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
              <span
                className="typing-dot"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="typing-dot"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
          placeholder="Type a message…"
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
    </div>
  );
}
