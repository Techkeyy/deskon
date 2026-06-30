"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function OnboardingWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to Deskon! 👋 I'll set up your AI deal-closer in a couple of minutes — no forms, just a chat.\n\nTo start: **what do you do?**",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [relayLink, setRelayLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, relayLink]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || relayLink) return;

    const userMessage = input.trim();
    setInput("");
    const updated = [...messages, { role: "user" as const, content: userMessage }];
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
        setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);

      if (data.finalized && data.slug) {
        const link = `${window.location.origin}/chat/${data.slug}`;
        setRelayLink(link);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Try again." }]);
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
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-neutral-950">
      <div className="border-b border-neutral-800 px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold text-black">
          D
        </div>
        <div>
          <h1 className="text-white font-semibold text-sm">Set up your Relay</h1>
          <p className="text-neutral-500 text-xs">Deskon onboarding</p>
        </div>
      </div>

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

        {relayLink && (
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-600/30 rounded-2xl p-5 space-y-3">
            <p className="text-amber-400 text-xs font-mono uppercase tracking-wider">Your Relay is live</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white truncate">
                {relayLink}
              </code>
              <button
                onClick={copyLink}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="text-neutral-400 text-sm">
              Share this anywhere — bio, WhatsApp, a tweet. Anyone who clicks it talks to your AI, which closes the deal and collects payment.
            </p>
            <a
              href={relayLink}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-amber-400 hover:text-amber-300 text-sm font-medium"
            >
              Preview your Relay →
            </a>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!relayLink && (
        <form onSubmit={sendMessage} className="border-t border-neutral-800 px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
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
      )}
    </div>
  );
}
