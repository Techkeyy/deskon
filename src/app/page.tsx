import Link from "next/link";
import Image from "next/image";

const REPO = "https://github.com/Techkeyy/deskon";
// Real settled order from Base mainnet — show, don't claim.
const PAY_TX =
  "0x7a7d5175390d0600f5579862f1bf70afb9aed0495b29ffdbcb99c40e74ac409a";
const BASESCAN = `https://basescan.org/tx/${PAY_TX}`;
// Deskon Relay is also natively hireable in the CROO agent store.
const CROO_STORE =
  "https://agent.croo.network/agents/517d961f-81b9-4735-b843-65f4515937a6";

const TAPE_ITEMS = [
  "Order 26489c6e",
  "$200.00 USDC",
  "Escrow cleared",
  "Base mainnet",
  "Settled",
  "Tx 0x7a7d5175…74ac409a",
  "CROO protocol",
];

const STEPS = [
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
];

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
          background: "rgba(247,245,239,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link href="/">
          <span
            className="display"
            style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            Deskon
          </span>
        </Link>

        <div className="nav-secondary" style={{ gap: 30 }}>
          <a href="#how" className="navlink">
            How it works
          </a>
          <a href="#proof" className="navlink">
            Proof
          </a>
          <Link href="/dashboard" className="navlink">
            Dashboard
          </Link>
        </div>
      </nav>

      <main>
        {/* ── Hero: headline beside the artifact ─────────── */}
        <section
          style={{
            padding: "104px 32px 110px",
            maxWidth: 1120,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div className="hero-grid">
            <div>
              <h1
                className="display"
                style={{
                  fontSize: "clamp(44px, 6.2vw, 78px)",
                }}
              >
                Share one link.
                <br />
                Your agent{" "}
                <em style={{ fontStyle: "italic", fontWeight: 500 }}>
                  closes
                </em>{" "}
                the deal.
              </h1>

              <p
                style={{
                  marginTop: 26,
                  fontSize: 17.5,
                  lineHeight: 1.65,
                  color: "var(--text-2)",
                  maxWidth: 480,
                }}
              >
                An AI closer that qualifies the lead, scopes the work, agrees a
                price, and settles payment on-chain — while you do the work
                that actually pays. No forms. No invoices. No chasing.
              </p>

              <div
                style={{
                  marginTop: 38,
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <Link href="/setup" className="btn btn-primary">
                  Create your Relay →
                </Link>
                <a href="#how" className="btn btn-ghost">
                  How it works
                </a>
              </div>
            </div>

            {/* The deal, set in type — the closer presents a real settlement. */}
            <div>
              <div
                style={{
                  position: "relative",
                  width: "82%",
                  margin: "0 auto",
                  aspectRatio: "1.15",
                }}
                aria-hidden="true"
              >
                <Image
                  src="/closer.png"
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 920px) 82vw, 440px"
                  style={{
                    objectFit: "cover",
                    objectPosition: "50% 10%",
                    mixBlendMode: "multiply",
                    // fade the crop edges so her cream ground melts into the page
                    maskImage:
                      "radial-gradient(ellipse 70% 62% at 50% 45%, black 52%, transparent 82%)",
                    WebkitMaskImage:
                      "radial-gradient(ellipse 70% 62% at 50% 45%, black 52%, transparent 82%)",
                  }}
                />
              </div>
              <div
                className="transcript"
                style={{ position: "relative", zIndex: 2, marginTop: -104 }}
              >
                <p
                  className="eyebrow"
                  style={{ marginBottom: 8, letterSpacing: "0.22em" }}
                >
                  Transcript — order 26489c6e
                </p>
                <div className="t-row">
                  <span className="t-who">Buyer</span>
                  <span className="t-line">
                    Need a logo for NovaPay — fintech, clean, geometric.
                  </span>
                </div>
                <div className="t-row">
                  <span className="t-who">Closer</span>
                  <span className="t-line">
                    Scope: primary mark, two revision rounds, vector files
                    included. I can do it for $200.
                  </span>
                </div>
                <div className="t-row">
                  <span className="t-who">Buyer</span>
                  <span className="t-line">Deal.</span>
                </div>
                <div className="t-row" style={{ paddingTop: 16 }}>
                  <span className="t-who" style={{ color: "var(--verify)" }}>
                    Settled
                  </span>
                  <span
                    className="num t-line"
                    style={{ color: "var(--text-1)" }}
                  >
                    $200.00 USDC · escrow cleared on Base
                  </span>
                </div>
              </div>
              <a
                href={BASESCAN}
                target="_blank"
                rel="noreferrer"
                className="navlink"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  color: "var(--text-3)",
                }}
              >
                Verify this deal on BaseScan →
              </a>
            </div>
          </div>
        </section>

        {/* ── Settlement tape ────────────────────────────── */}
        <a href={BASESCAN} target="_blank" rel="noreferrer" className="tape">
          <div className="tape-inner" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div key={copy} style={{ display: "flex" }}>
                {[...TAPE_ITEMS, ...TAPE_ITEMS].map((item, i) => (
                  <span
                    key={`${copy}-${i}`}
                    className="tape-item"
                    style={
                      item === "Settled"
                        ? { color: "var(--verify)" }
                        : undefined
                    }
                  >
                    {item} <span style={{ marginLeft: 34 }}>·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </a>

        {/* ── How it works: the ledger ───────────────────── */}
        <section
          id="how"
          style={{
            padding: "100px 32px 110px",
            background: "var(--bg-2)",
          }}
        >
          <div style={{ maxWidth: 1120, margin: "0 auto" }}>
            <p className="eyebrow">How it works</p>
            <h2
              className="display"
              style={{
                fontSize: "clamp(30px, 4vw, 44px)",
                marginTop: 16,
                marginBottom: 64,
              }}
            >
              Configured by chatting.
              <br />
              Closed by chatting.
            </h2>

            {STEPS.map((s) => (
              <div key={s.n} className="step-row">
                <span className="ghost-num num" aria-hidden="true">
                  {s.n}
                </span>
                <div style={{ maxWidth: 560 }}>
                  <h3
                    className="display"
                    style={{ fontSize: 26, fontWeight: 600 }}
                  >
                    {s.title}
                  </h3>
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 16,
                      lineHeight: 1.65,
                      color: "var(--text-2)",
                    }}
                  >
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Proof: the settlement slip ─────────────────── */}
        <section
          id="proof"
          style={{
            padding: "100px 32px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ maxWidth: 1120, margin: "0 auto" }}>
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
              Not a mockup. A real order negotiated, paid, and delivered
              through the CROO protocol on Base mainnet. Verify it yourself.
            </p>

            <div className="slip" style={{ marginTop: 44 }}>
              <span className="stamp">Escrow cleared</span>

              <span className="eyebrow" style={{ letterSpacing: "0.24em" }}>
                Settlement slip
              </span>

              <div style={{ marginTop: 18 }}>
                <SlipRow label="Order">26489c6e · NovaPay logo</SlipRow>
                <SlipRow label="Amount">
                  <span style={{ color: "var(--accent-soft)" }}>$200.00</span>{" "}
                  USDC
                </SlipRow>
                <SlipRow label="Network">Base mainnet</SlipRow>
                <SlipRow label="Protocol">CROO · negotiate → lock → clear</SlipRow>
                <SlipRow label="Pay tx">7a7d5175…74ac409a</SlipRow>
              </div>

              <div
                style={{
                  marginTop: 26,
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href={BASESCAN}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                >
                  View on BaseScan →
                </a>
                <a
                  href={CROO_STORE}
                  target="_blank"
                  rel="noreferrer"
                  className="navlink"
                  style={{ color: "var(--text-3)" }}
                >
                  Or hire the agent on the CROO store →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ───────────────────────────────── */}
        <section
          style={{
            padding: "110px 32px 90px",
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

        {/* ── Sign-off wordmark ─────────────────────────── */}
        <div className="wordmark-crop" aria-hidden="true">
          <span className="wordmark">Deskon</span>
        </div>
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
          <a href={CROO_STORE} target="_blank" rel="noreferrer" className="navlink">
            CROO store
          </a>
        </div>
      </footer>
    </div>
  );
}

function SlipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="slip-row">
      <span
        className="eyebrow"
        style={{ width: 84, flexShrink: 0, letterSpacing: "0.18em" }}
      >
        {label}
      </span>
      <span className="num mono" style={{ fontSize: 14, color: "var(--text-1)" }}>
        {children}
      </span>
    </div>
  );
}
