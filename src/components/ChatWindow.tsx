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
  const greeting: Message = {
    role: "assistant",
    content: `I'm the closer for **${sellerName}**. I handle the inquiry, scope the work, and settle payment — so ${sellerName} can stay on the work.\n\nWhat are you after?`,
  };
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const storageKey = `deskon:chat:${slug}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // If this browser already has a conversation with this closer, resume it
  // from the server (survives refresh and cold starts).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {
      /* storage disabled */
    }
    if (!saved) return;

    (async () => {
      try {
        const res = await fetch(
          `/api/chat?conversationId=${encodeURIComponent(saved)}`
        );
        if (!res.ok) {
          sessionStorage.removeItem(storageKey);
          return;
        }
        const data = await res.json();
        setConversationId(data.conversationId);
        setStatus(data.status);
        setMessages([
          greeting,
          ...data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            metadata: m.metadata,
          })),
        ]);
      } catch {
        /* resume is best-effort */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerName, slug]);

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
      try {
        sessionStorage.setItem(storageKey, data.conversationId);
      } catch {
        /* storage disabled — chat still works, just won't survive refresh */
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          // Map the raw function-call name to the metadata type the renderer
          // expects — initiate_payment is what puts the Pay button on screen.
          metadata: data.functionCall
            ? {
                type:
                  data.functionCall.name === "initiate_payment"
                    ? "payment_prompt"
                    : "deal_summary",
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

  async function handlePay() {
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
        const handoff = data.deliveryInstructions
          ? `\n\nNext step: ${data.deliveryInstructions}`
          : ` ${sellerName} will reach out to start the work.`;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Payment cleared. Your order is locked in escrow on Base.${handoff}\n\nWhen the work arrives, confirm delivery below to release the funds — or they release automatically after 7 days.`,
            metadata: { type: "payment_confirmed" },
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

  async function confirmDelivery() {
    if (!conversationId || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/order/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfirmed(true);
        if (!data.alreadyReleased) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Delivery confirmed — funds released to the seller. Pleasure doing business.",
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Could not confirm." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    } finally {
      setConfirming(false);
    }
  }

  // The confirm button rides on the most recent payment-confirmed message.
  const lastConfirmIdx = messages.reduce(
    (acc, m, i) => (m.metadata?.type === "payment_confirmed" ? i : acc),
    -1
  );

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
        <span className="display" style={{ fontSize: 19, fontWeight: 700 }}>
          {sellerName}
        </span>
        <span
          aria-hidden="true"
          style={{ width: 1, height: 16, background: "var(--border-strong)" }}
        />
        <span className="eyebrow" style={{ fontSize: 9.5 }}>
          Closing via Deskon
        </span>
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
              {msg.role === "user" ? "You" : "Closer"}
            </span>
            <div className="t-body">
              <div>{renderContent(msg.content)}</div>

              {msg.metadata?.type === "payment_prompt" &&
                msg.metadata.amount && (
                  <div
                    style={{
                      marginTop: 16,
                      maxWidth: 380,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      borderRadius: 12,
                      padding: "18px 20px",
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
                      onClick={() => handlePay()}
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

              {msg.metadata?.type === "payment_confirmed" &&
                i === lastConfirmIdx &&
                !confirmed && (
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 14 }}
                    onClick={confirmDelivery}
                    disabled={confirming}
                  >
                    {confirming
                      ? "Releasing…"
                      : "Confirm delivery — release funds"}
                  </button>
                )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="t-msg" style={{ borderBottom: "none" }}>
            <span className="t-who">Closer</span>
            <div style={{ display: "flex", gap: 5, paddingTop: 6 }}>
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
          className="line-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={loading}
        />
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
