import Link from "next/link";
import { QrPhPaymentFlow } from "../../../components/qrph-payment-flow";
import styles from "./qrph.module.css";

export const metadata = {
  title: "PayRail PH — QR Ph Sandbox Checkout Demo",
  description:
    "Interactive Philippine QR Ph sandbox payment demonstration integrated with PayMongo test environment.",
};

export default function QrPhDemoPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            PayRail <span>PH</span>
          </Link>
          <div className={styles.actions}>
            <span className={styles.badgeSandbox}>SANDBOX ENVIRONMENT</span>
            <Link href="/ops" className={styles.consoleLink}>
              Operator Console ↗
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.heroSection}>
          <h1 className={styles.title}>QR Ph Checkout Demo</h1>
          <p className={styles.subtitle}>
            Experience simple, real-time Philippine QR Ph payments powered by PayMongo sandbox.
          </p>
        </div>

        <section aria-label="QR Ph Sandbox Terminal">
          <QrPhPaymentFlow />
        </section>

        <section className={styles.explainerCard}>
          <h2 className={styles.explainerTitle}>Fintech Engineering Invariants in this Flow</h2>
          <div className={styles.explainerGrid}>
            <div>
              <h3>1. Exactly-Once Idempotency</h3>
              <p>
                Every payment creation sends an authoritative <code>Idempotency-Key</code> header.
                PostgreSQL checks the unique constraint before dispatching to PayMongo, preventing
                duplicate charges even during network timeouts or double-clicks.
              </p>
            </div>
            <div>
              <h3>2. Cryptographic Verification</h3>
              <p>
                When a payment is captured in the PayMongo simulator, a webhook is sent to PayRail.
                The event payload is verified using HMAC-SHA256 with timing-safe comparison before
                any internal payment state is allowed to advance to <code>SUCCEEDED</code>.
              </p>
            </div>
            <div>
              <h3>3. Conservation of Funds</h3>
              <p>
                Upon verified payment confirmation, a balanced ledger journal is written to the
                double-entry ledger: debiting Cash Clearing and crediting Merchant Settlement
                Payable and Platform Fee Revenue. <code>∑ Debits === ∑ Credits</code> at all times.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          PayRail PH · Educational Sandbox Architecture · No real money processed ·{" "}
          <Link href="/">Back to Home</Link>
        </p>
      </footer>
    </div>
  );
}
