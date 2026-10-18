import Image from "next/image";
import heroFlow from "../../public/images/payrail-verified-flow.jpg";
import mountainHorizon from "../../public/images/payrail-mountain-horizon.jpg";
import { QrPhPaymentFlow } from "../components/qrph-payment-flow";

const steps = [
  {
    number: "1",
    symbol: "▤",
    title: "Create attempt",
    detail: "A payment attempt is created in test mode and recorded with a pending status.",
  },
  {
    number: "2",
    symbol: "✓",
    title: "Verify webhook",
    detail:
      "Incoming PayMongo webhook events are checked for authenticity, relevance, and idempotency.",
  },
  {
    number: "3",
    symbol: "◎",
    title: "Persist work",
    detail:
      "Verified events are stored, linking provider evidence to internal payment state changes.",
  },
  {
    number: "4",
    symbol: "▤",
    title: "Post balanced ledger",
    detail:
      "State changes trigger balanced ledger entries to keep records consistent and auditable.",
  },
];

export default function Home() {
  return (
    <main id="top">
      <header className="site-header page-gutter">
        <a className="wordmark" href="#top" aria-label="PayRail PH home">
          PayRail <span>PH</span>
        </a>
        <nav className="primary-nav" aria-label="Main navigation">
          <a href="#system">System design</a>
          <a href="/ops/reliability-lab">Reliability Lab</a>
          <span className="nav-divider" aria-hidden="true" />
          <a className="nav-access" href="/ops">
            Operator portal <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <section className="hero page-gutter" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="hero-label hero-label-sandbox">SANDBOX ONLY</p>
          <p className="hero-label hero-label-provider">PAYMONGO TEST MODE</p>
          <h1 id="hero-title">PayRail PH</h1>
          <h2>
            Payments move forward only
            <br className="wide-break" /> after verified provider evidence
            <br className="wide-break" /> is recorded.
          </h2>
          <p className="hero-intro">
            A technical portfolio showing how PayMongo sandbox payments are verified, persisted, and
            reconciled with an internal ledger.
          </p>
          <a className="primary-link" href="#system">
            See how it works <span aria-hidden="true">→</span>
          </a>
          <p className="evidence-note" id="reliability" role="status">
            <span className="status-dot" aria-hidden="true" />
            <span>
              Sandbox integration evidence: <b>pending</b>
            </span>
          </p>
        </div>

        <figure className="hero-diagram" aria-labelledby="diagram-caption">
          <div className="diagram-canvas">
            <Image
              className="flow-image"
              src={heroFlow}
              alt="Payment provider, orchestration service, PostgreSQL database, and ledger connected in sequence."
              priority
              unoptimized
              sizes="(max-width: 800px) 100vw, 55vw"
            />
            <p className="diagram-callout callout-provider">
              <b>Provider event</b>
              <span>(webhook)</span>
            </p>
            <p className="diagram-callout callout-verify">
              <b>Verify provider evidence</b>
              <span>before changing state</span>
            </p>
            <p className="diagram-callout callout-persist">
              <b>Persist work</b>
              <span>(idempotent)</span>
            </p>
            <p className="diagram-callout callout-ledger">
              <b>Post balanced</b>
              <span>ledger entries</span>
            </p>
          </div>
          <figcaption id="diagram-caption" className="diagram-caption">
            <span>
              PAYMONGO
              <br />
              SANDBOX
            </span>
            <span>
              PAYRAIL PH
              <br />
              <small>VERIFICATION · PERSISTENCE · RECONCILIATION</small>
            </span>
            <span>
              INTERNAL
              <br />
              LEDGER
            </span>
          </figcaption>
        </figure>
      </section>

      <section
        className="page-gutter"
        id="interactive-demo"
        aria-label="Interactive QR Ph sandbox demonstration"
      >
        <QrPhPaymentFlow />
      </section>

      <section className="system-section page-gutter" id="system" aria-label="Payment lifecycle">
        <ol className="flow-steps">
          {steps.map((step) => (
            <li key={step.number}>
              <div className="step-heading">
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                {step.number !== "4" && (
                  <span className="step-arrow" aria-hidden="true">
                    →
                  </span>
                )}
              </div>
              <span className="step-symbol" aria-hidden="true">
                {step.symbol}
              </span>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="site-footer page-gutter" id="access">
        <div className="footer-content">
          <p>Engineering for verifiable payments.</p>
          <div className="footer-meta">
            <span>PayRail PH</span>
            <span aria-hidden="true">·</span>
            <span>PayMongo test mode</span>
            <span aria-hidden="true">·</span>
            <span>Sandbox only</span>
          </div>
          <p className="operator-note">
            <b>Private operations</b> require authenticated operator access.{" "}
            <a
              href="/ops"
              style={{
                color: "var(--color-cobalt)",
                textDecoration: "underline",
                marginLeft: "4px",
              }}
            >
              Launch Console ↗
            </a>
          </p>
        </div>
        <Image
          className="mountain-art"
          src={mountainHorizon}
          alt=""
          aria-hidden="true"
          unoptimized
          sizes="100vw"
        />
      </footer>
    </main>
  );
}
