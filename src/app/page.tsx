import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold text-black">
            D
          </div>
          <span className="font-semibold text-lg tracking-tight">Deskon</span>
        </div>
        <Link
          href="/chat/demo"
          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          Try Demo
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl space-y-6">
          <p className="text-amber-500 text-sm font-mono tracking-wider uppercase">
            Powered by CROO Protocol
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1]">
            Share a link.
            <br />
            <span className="text-amber-500">Get paid.</span>
          </h1>
          <p className="text-neutral-400 text-lg max-w-lg mx-auto leading-relaxed">
            Your AI handles everything from the first click to the money hitting your wallet.
            No forms. No invoices. No chasing payments.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link
              href="/chat/demo"
              className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              See it in action
            </Link>
            <Link
              href="/setup"
              className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Create your Relay
            </Link>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-24 max-w-3xl w-full">
          <h2 className="text-sm font-mono text-neutral-500 tracking-wider uppercase mb-8">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              {
                step: "01",
                title: "Set up by chatting",
                desc: "Tell your AI what you offer and your pricing. No forms — just a conversation.",
              },
              {
                step: "02",
                title: "Share your link",
                desc: "Put it in your bio, WhatsApp status, or tweet. Anyone can click it.",
              },
              {
                step: "03",
                title: "AI closes the deal",
                desc: "Your Relay qualifies leads, negotiates scope, and collects payment on-chain via CROO.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                <span className="text-amber-600 font-mono text-xs">{item.step}</span>
                <h3 className="text-white font-semibold mt-2 mb-1 text-sm">{item.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 px-6 py-4 text-center text-xs text-neutral-600">
        Built on CROO Agent Protocol — Base Network
      </footer>
    </div>
  );
}
