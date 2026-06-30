import Link from "next/link";

const REPO = "https://github.com/Techkeyy/deskon";
// Real settled order from Base mainnet — show, don't claim.
const PAY_TX =
  "0x7a7d5175390d0600f5579862f1bf70afb9aed0495b29ffdbcb99c40e74ac409a";
const BASESCAN = `https://basescan.org/tx/${PAY_TX}`;

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: "var(--nav-h)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(10,10,12,0.72)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            D
          </span>
          <span
            className="display"
            style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            Deskon
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div className="nav-secondary">
            <a href="#how" className="navlink">
              How it works
            </a>
            <a href="#proof" className="navlink">
              Proof
            </a>
            <Link href="/chat/demo" className="navlink">
              Demo
            </Link>
          </div>
          <Link href="/setup" className="btn btn-primary">
            Create your Relay
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <main>
        <section
          style={{
            padding: "120px 32px 130px",
            maxWidth: 1080,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <a
            href={BASESCAN}
            target="_blank"
            rel="noreferrer"
            className="badge"
            style={{ textDecoration: "none" }}
          >
            <span className="badge-dot" />
            <span
              className="num"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--accent-soft)",
              }}
            >
              Live on Base mainnet
            </span>
          </a>

          <h1
            className="display"
            style={{
              fontSize: "clamp(46px, 8vw, 92px)",
              marginTop: 32,
              maxWidth: 880,
            }}
          >
            Share one link.
            <br />
            Your agent closes the deal.
          </h1>

          <p
            style={{
              marginTop: 30,
              fontSize: 18,
              lineHeight: 1.6,
              color: "var(--text-2)",
              maxWidth: 560,
            }}
          >
            An AI closer that qualifies the lead, scopes the work, agrees a
            price, and settles payment on-chain — while you do the work that
            actually pays. No forms. No invoices. No chasing.
          </p>

          <div
            style={{
              marginTop: 40,
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Link href="/setup" className="btn btn-primary">
              Create your Relay →
            </Link>
            <Link href="/chat/demo" className="btn btn-ghost">
              Talk to a live closer
            </Link>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────── */}
        <section
          id="how"
          style={{
            padding: "100px 32px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-2)",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <p className="eyebrow">How it works</p>
            <h2
              className="display"
              style={{ fontSize: "clamp(30px, 4vw, 44px)", marginTop: 16 }}
            >
              Configured by chatting. Closed by chatting.
            </h2>

            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 1,
                background: "var(--border)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {[
                {
                  n: "01",
                  title: "Set up by talking",
                  body: "Tell the agent what you sell and your price bounds. It writes its own brief — no forms, no dashboard.",
                },
                {
                  n: "02",
                  title: "Share your link",
                  body: "Drop it in a bio, a DM, an email signature. Anyone who opens it is talking to your closer in seconds.",
                },
                {
                  n: "03",
                  title: "Get paid on-chain",
                  body: "It scopes the job, holds your price floor, and settles USDC in escrow on Base. You just deliver.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  style={{ background: "var(--bg)", padding: "36px 32px" }}
                >
                  <span
                    className="num"
                    style={{
                      fontSize: 13,
                      color: "var(--accent-soft)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {s.n}
                  </span>
                  <h3
                    className="display"
                    style={{ fontSize: 21, fontWeight: 700, margin: "14px 0 10px" }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "var(--text-2)",
                    }}
                  >
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Proof ─────────────────────────────────────── */}
        <section
          id="proof"
          style={{
            padding: "100px 32px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>
            <p className="eyebrow">Proof</p>
            <h2
              className="display"
              style={{ fontSize: "clamp(30px, 4vw, 44px)", marginTop: 16 }}
            >
              Every deal settles on-chain.
            </h2>
            <p
              style={{
                marginTop: 18,
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--text-2)",
                maxWidth: 520,
              }}
            >
              Not a mockup. A real order negotiated, paid, and delivered through
              the CROO protocol on Base mainnet. Verify it yourself.
            </p>

            <div
              style={{
                marginTop: 44,
                border: "1px solid var(--verify-border)",
                background: "var(--verify-dim)",
                borderRadius: 14,
                padding: "32px",
                maxWidth: 620,
              }}
            >
              <span
                className="eyebrow"
                style={{ color: "var(--verify)", letterSpacing: "0.24em" }}
              >
                Settled
              </span>

              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <Row label="Order">26489c6e · NovaPay logo</Row>
                <Row label="Amount">
                  <span style={{ color: "var(--accent-soft)" }}>$200.00</span>{" "}
                  USDC
                </Row>
                <Row label="Network">Base mainnet · escrow cleared</Row>
                <Row label="Pay tx">7a7d5175…74ac409a</Row>
              </div>

              <a
                href={BASESCAN}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
                style={{ marginTop: 28 }}
              >
                View on BaseScan →
              </a>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ───────────────────────────────── */}
        <section
          style={{
            padding: "110px 32px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-2)",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2
              className="display"
              style={{ fontSize: "clamp(32px, 5vw, 52px)" }}
            >
              Put your closer to work.
            </h2>
            <p
              style={{
                marginTop: 20,
                fontSize: 17,
                lineHeight: 1.6,
                color: "var(--text-2)",
              }}
            >
              Two minutes of chatting and your link is live.
            </p>
            <div
              style={{
                marginTop: 36,
                display: "flex",
                gap: 14,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link href="/setup" className="btn btn-primary">
                Create your Relay →
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "28px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span className="eyebrow">Deskon · Built on CROO Agent Protocol</span>
        <div style={{ display: "flex", gap: 24 }}>
          <a href={REPO} target="_blank" rel="noreferrer" className="navlink">
            GitHub
          </a>
          <a href={BASESCAN} target="_blank" rel="noreferrer" className="navlink">
            On-chain proof
          </a>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
      <span
        className="eyebrow"
        style={{ width: 78, flexShrink: 0, letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span
        className="num mono"
        style={{ fontSize: 14, color: "var(--text-1)" }}
      >
        {children}
      </span>
    </div>
  );
}
