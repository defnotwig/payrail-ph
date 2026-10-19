import Link from "next/link";
import styles from "./page.module.css";
import { OrchestrationVisual } from "../components/orchestration-visual";
import { FlowSection } from "../components/flow-section";
import { ProductPreview } from "../components/product-preview";

export default function Home() {
  return (
    <main id="top" className={styles.main}>
      {/* 1. Public Navigation Header */}
      <header className={`page-gutter ${styles.siteHeader}`}>
        <a className={styles.wordmark} href="#top" aria-label="PayRail PH home">
          PayRail <span>PH</span>
        </a>
        <nav className={styles.primaryNav} aria-label="Main navigation">
          <a className={styles.navLink} href="#flow">
            How it works
          </a>
          <Link className={styles.navLink} href="/demo/qrph">
            QR Ph Demo
          </Link>
          <Link className={styles.navLink} href="/ops/reliability-lab">
            Reliability
          </Link>
          <Link className={styles.navButton} href="/ops">
            Open Console <span aria-hidden="true">→</span>
          </Link>
        </nav>
      </header>

      {/* 2. Hero Section: Headline + Restrained Orchestration Visual */}
      <section className={`page-gutter ${styles.hero}`} aria-labelledby="hero-title">
        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <div className={styles.envBadge} role="status" title="No real funds processed">
              <span className={styles.envDot} aria-hidden="true" />
              <span>TEST ENVIRONMENT</span>
            </div>

            <h1 id="hero-title" className={styles.heroTitle}>
              Payments that stay correct when systems don&apos;t.
            </h1>

            <p className={styles.heroIntro}>
              PayRail demonstrates payment orchestration, signed webhooks, idempotent financial
              effects, double-entry ledgering and operational recovery using a real PayMongo sandbox
              integration.
            </p>

            <div className={styles.ctaGroup}>
              <Link className={styles.primaryCta} href="/demo/qrph">
                Run QR Ph demo <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.secondaryCta} href="/ops">
                Explore operations <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>

          <OrchestrationVisual />
        </div>
      </section>

      {/* 3. Section 2: 6-Step End-to-End Payment Flow */}
      <FlowSection />

      {/* 4. Section 3: Three Capability Pillars */}
      <section className={`page-gutter ${styles.pillarsSection}`} aria-labelledby="pillars-title">
        <div className={styles.pillarsGrid}>
          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <span className={styles.pillarIcon} aria-hidden="true">
                ⚡
              </span>
              <h3 className={styles.pillarTitle}>Process</h3>
            </div>
            <p className={styles.pillarBody}>
              Create and track real QR Ph transactions with instant provider simulator integration,
              dynamic fee policy evaluation, and sub-second confirmation telemetry.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <span className={styles.pillarIcon} aria-hidden="true">
                🛡
              </span>
              <h3 className={styles.pillarTitle}>Protect</h3>
            </div>
            <p className={styles.pillarBody}>
              Prevent duplicate financial effects with merchant-scoped idempotency keys,
              constant-time HMAC signature verification, and row-level aggregate refund guards.
            </p>
          </div>

          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <span className={styles.pillarIcon} aria-hidden="true">
                🔄
              </span>
              <h3 className={styles.pillarTitle}>Recover</h3>
            </div>
            <p className={styles.pillarBody}>
              Audit exceptions with automated 3-way reconciliation, fail closed with provider
              circuit breakers, and replay dead-lettered background jobs with lease fencing.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Section 4: Operational Product Proof */}
      <ProductPreview />

      {/* 6. Section 5: Technical Proof for Engineers */}
      <section className={`page-gutter ${styles.techProofSection}`} aria-labelledby="tech-title">
        <div className={styles.techProofTitleArea}>
          <h2 id="tech-title" className={styles.techProofTitle}>
            Engineered for payment failure modes
          </h2>
          <p className={styles.techProofSubtitle}>
            Financial software designed with strict database invariants and zero simulated facades.
          </p>
        </div>

        <div className={styles.techGrid}>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>Real PayMongo sandbox API & QR Ph generator</p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>Constant-time HMAC-SHA256 signature verification</p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>Merchant-scoped idempotency locking (409 Conflict)</p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>Balanced double-entry ledger: Debits == Credits</p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>PostgreSQL row-level locking (SELECT ... FOR UPDATE)</p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>
              Aggregate refund capacity guards preventing over-refunds
            </p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>Automated 3-way reconciliation audit runs</p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>
              Durable background workers with Dead Letter Queue (DLQ)
            </p>
          </div>
          <div className={styles.techItem}>
            <span className={styles.techCheck} aria-hidden="true">
              ✓
            </span>
            <p className={styles.techText}>ISO 8583 financial message parser & bitmap inspector</p>
          </div>
        </div>
      </section>

      {/* 7. Section 6: Final CTA & Minimal Footer */}
      <section className={styles.finalCtaSection} aria-labelledby="cta-title">
        <div className={styles.finalCtaContent}>
          <h2 id="cta-title" className={styles.finalCtaTitle}>
            See the payment flow yourself.
          </h2>
          <p className={styles.finalCtaSubtitle}>
            Run a genuine PayMongo sandbox transaction with live webhook confirmation.
          </p>
          <div className={styles.ctaGroup}>
            <Link className={styles.primaryCta} href="/demo/qrph">
              Run QR Ph demo <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.secondaryCta} href="/ops">
              Explore operations <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className={`page-gutter ${styles.siteFooter}`}>
        <div className={styles.footerContent}>
          <div className={styles.footerLeft}>
            <strong>PayRail PH</strong>
            <span>·</span>
            <span>Engineering demonstration for verifiable payment systems</span>
            <span>·</span>
            <span>TEST ENVIRONMENT · No real funds</span>
          </div>
          <div className={styles.footerLinks}>
            <Link className={styles.footerLink} href="/demo/qrph">
              Demo
            </Link>
            <Link className={styles.footerLink} href="/ops">
              Operations
            </Link>
            <Link className={styles.footerLink} href="/ops/reliability-lab">
              Reliability
            </Link>
            <Link className={styles.footerLink} href="/ops/iso8583">
              ISO 8583
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
