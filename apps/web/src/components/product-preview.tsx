"use client";

import styles from "./product-preview.module.css";

export function ProductPreview() {
  return (
    <section
      className={`page-gutter ${styles.section}`}
      id="operations-preview"
      aria-labelledby="ops-preview-title"
    >
      <div className={styles.titleArea}>
        <h2 id="ops-preview-title" className={styles.title}>
          Operations console built for financial truth
        </h2>
        <p className={styles.subtitle}>
          Direct visibility into every payment lifecycle state, webhook signature, and double-entry
          ledger entry.
        </p>
      </div>

      <div className={styles.browserFrame}>
        <div className={styles.browserHeader}>
          <div className={styles.dots} aria-hidden="true">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
          <div className={styles.urlBar}>https://payrail-ph-web-main.vercel.app/ops</div>
          <div style={{ width: "42px" }} />
        </div>

        <div className={styles.browserBody}>
          <div className={styles.metricsRow}>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Total Payments</p>
              <p className={styles.metricValue}>100.0% Success</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>P95 Latency</p>
              <p className={styles.metricValue}>340 ms</p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>Ledger Invariant</p>
              <p className={styles.metricValue} style={{ color: "#34d399" }}>
                Debits == Credits
              </p>
            </div>
            <div className={styles.metricCard}>
              <p className={styles.metricLabel}>PayMongo Gateway</p>
              <p className={styles.metricValue} style={{ color: "#38bdf8" }}>
                Circuit CLOSED
              </p>
            </div>
          </div>

          <div className={styles.calloutsContainer}>
            <div className={styles.calloutCard}>
              <span
                className={`${styles.calloutDot} ${styles.calloutDotSuccess}`}
                aria-hidden="true"
              />
              <div>
                <h3 className={styles.calloutTitle}>Signed Webhook Verification</h3>
                <p className={styles.calloutText}>
                  HMAC-SHA256 signatures are validated in constant time before mutating internal
                  transaction state.
                </p>
              </div>
            </div>

            <div className={styles.calloutCard}>
              <span
                className={`${styles.calloutDot} ${styles.calloutDotPurple}`}
                aria-hidden="true"
              />
              <div>
                <h3 className={styles.calloutTitle}>Balanced Double-Entry Ledger</h3>
                <p className={styles.calloutText}>
                  Every completed payment posts immutable balanced journal entries to guarantee
                  monetary integrity.
                </p>
              </div>
            </div>

            <div className={styles.calloutCard}>
              <span className={styles.calloutDot} aria-hidden="true" />
              <div>
                <h3 className={styles.calloutTitle}>Provider Circuit Breaker</h3>
                <p className={styles.calloutText}>
                  Fails closed with exponential backoff and half-open probing during upstream
                  provider degradation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
