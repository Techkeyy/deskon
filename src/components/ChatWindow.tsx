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

export default function ChatWindow({ slug, sellerName }: { slug: string; sellerName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [paying, setPaying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send opening message on first load
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Hey! 👋 I'm the AI assistant for **${sellerName}**. I handle inquiries, scope projects, and close deals — so ${sellerName} can focus on the work.\n\nWhat are you looking for?`,
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
          { role: "assistant", content: "Sorry, something went wrong. Please try again." },
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
            ? { type: data.functionCall.name, amount: data.functionCall.args?.amount || data.functionCall.args?.price }
            : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(amount: number) {
    if (!conversationId || paying) return;
    setPaying(true);
    setMessages((prev) => [...prev, { role: "assistant", content: `Processing payment of $${amount} USDC on Base...` }]);

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
            content: `✅ Payment confirmed! Your order is locked in escrow on Base. ${sellerName} will reach out to start the work.`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${data.error || "Payment could not be completed."}` },
        ]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Payment connection error." }]);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold text-black">
          {sellerName.charAt(0)}
        </div>
        <div>
          <h1 className="text-white font-semibold text-sm">{sellerName}</h1>
          <p className="text-neutral-500 text-xs">Powered by Deskon</p>
        </div>
        {status === "payment_pending" && (
          <span className="ml-auto text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
            Payment pending
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-amber-600 text-white"
                  : "bg-neutral-900 text-neutral-200 border border-neutral-800"
              }`}
            >
              <div className="whitespace-pre-wrap">
                {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) =>
                  part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={j} className="font-semibold text-white">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </div>
              {msg.metadata?.type === "payment_prompt" && msg.metadata.amount && (
                <button
                  className="mt-3 w-full bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 disabled:text-neutral-400 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
                  onClick={() => handlePay(msg.metadata!.amount!)}
                  disabled={paying || status === "completed"}
                >
                  {paying ? "Processing..." : status === "completed" ? "Paid ✓" : `Pay $${msg.metadata.amount} USDC`}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-neutral-800 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-amber-600 transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
