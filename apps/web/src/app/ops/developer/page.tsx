"use client";

import { useState } from "react";
import { PageHeader, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: "ACTIVE" | "DISABLED";
  secretMasked: string;
}

export default function DeveloperPlatformPage() {
  const [createdPlainKey, setCreatedPlainKey] = useState<string | null>(null);
  const [endpointUrl, setEndpointUrl] = useState("https://merchant.example.com/api/webhooks");
  const [ssrfError, setSsrfError] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: "key_0192a801",
      name: "Default Sandbox Server Key",
      prefix: "pr_test_9921",
      scopes: ["payments:read", "payments:write", "refunds:write"],
      createdAt: "Today, 10:00:00",
    },
  ]);

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
    {
      id: "wh_0192a701",
      url: "https://merchant.example.com/api/webhooks",
      events: ["payment.succeeded", "refund.succeeded"],
      status: "ACTIVE",
      secretMasked: "whsec_99a8...f812",
    },
  ]);

  const handleCreateKey = () => {
    const rawKey = `pr_test_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    setCreatedPlainKey(rawKey);

    const newKey: ApiKey = {
      id: `key_${Date.now().toString(36)}`,
      name: `Automated Key ${apiKeys.length + 1}`,
      prefix: rawKey.substring(0, 12),
      scopes: ["payments:read", "payments:write"],
      createdAt: "Just now",
    };
    setApiKeys([newKey, ...apiKeys]);
  };

  const handleAddEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    setSsrfError(null);

    // SSRF validation simulation
    const urlLower = endpointUrl.toLowerCase();
    if (
      urlLower.includes("localhost") ||
      urlLower.includes("127.0.0.1") ||
      urlLower.includes("169.254.169.254") ||
      urlLower.includes("10.") ||
      urlLower.includes("192.168.")
    ) {
      setSsrfError(
        "SSRF Security Violation: Outbound webhook endpoints cannot point to loopback, RFC 1918 private subnets, or cloud metadata addresses (169.254.169.254).",
      );
      return;
    }

    const newEndpoint: WebhookEndpoint = {
      id: `wh_${Date.now().toString(36)}`,
      url: endpointUrl,
      events: ["payment.succeeded", "payment.failed"],
      status: "ACTIVE",
      secretMasked: `whsec_${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
    };
    setWebhooks([newEndpoint, ...webhooks]);
  };

  return (
    <div>
      <PageHeader
        title="Merchant API Platform & Outbound Webhooks"
        subtitle="Cryptographically hashed API key credentials (SHA-256) and SSRF-hardened HMAC-signed outbound webhooks."
        actions={
          <button type="button" className={styles.buttonPrimary} onClick={handleCreateKey}>
            + Generate New API Key
          </button>
        }
      />

      {createdPlainKey && (
        <div className={styles.card} style={{ border: "1px solid #86efac", background: "#f0fdf4" }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle} style={{ color: "#166534" }}>
              🔑 New Merchant API Key Generated
            </h2>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={() => setCreatedPlainKey(null)}
            >
              Dismiss
            </button>
          </div>
          <p style={{ fontSize: "13px", color: "#166534", margin: "0 0 10px 0" }}>
            Copy this secret key immediately. For PCI and security compliance,{" "}
            <strong>we never store the plaintext key</strong> in our database (only the SHA-256
            digest is persisted).
          </p>
          <div className={styles.codeBlock} style={{ color: "#86efac", fontWeight: 600 }}>
            {createdPlainKey}
          </div>
        </div>
      )}

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Merchant API Keys ({apiKeys.length})</h2>
            <span className={styles.badgePill}>SHA-256 HASHED STORAGE</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name / ID</th>
                  <th scope="col">Key Prefix</th>
                  <th scope="col">Scopes</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <div>
                        <strong>{key.name}</strong>
                      </div>
                      <code style={{ fontSize: "11px", color: "var(--color-text-muted, #64748b)" }}>
                        {key.id}
                      </code>
                    </td>
                    <td>
                      <code>{key.prefix}...</code>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {key.scopes.map((s) => (
                          <span key={s} className={styles.badgePill} style={{ fontSize: "10px" }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status="SUCCEEDED" customLabel="ACTIVE" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Register Outbound Webhook</h2>
            <StatusBadge status="SUCCEEDED" customLabel="SSRF HARDENED" />
          </div>
          <form
            onSubmit={handleAddEndpoint}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <div>
              <label
                htmlFor="endpoint-url-input"
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary, #475569)",
                  display: "block",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}
              >
                HTTPS Webhook Endpoint URL
              </label>
              <input
                id="endpoint-url-input"
                type="text"
                className={styles.inputField}
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
              />
            </div>
            {ssrfError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  padding: "10px",
                  borderRadius: "6px",
                  color: "#991b1b",
                  fontSize: "12px",
                }}
                role="alert"
              >
                {ssrfError}
              </div>
            )}
            <button type="submit" className={styles.buttonPrimary}>
              Register Webhook Endpoint
            </button>
          </form>

          <div style={{ marginTop: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
            <h3
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted, #64748b)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: "0 0 6px 0",
              }}
            >
              Outbound Webhook Signature Scheme
            </h3>
            <div className={styles.codeBlock} style={{ fontSize: "11px" }}>
              {`Header: payrail-signature: t=1729243800,v1=9a8f...4e1b
Payload: HMAC-SHA256(key=endpoint_secret, data="\${timestamp}.\${raw_body}")`}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Configured Webhook Endpoints (payrail_private.merchant_webhook_endpoints)
          </h2>
          <span className={styles.badgePill}>{webhooks.length} ENDPOINTS</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Endpoint ID</th>
                <th scope="col">Target URL</th>
                <th scope="col">Subscribed Events</th>
                <th scope="col">Signing Secret</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh) => (
                <tr key={wh.id}>
                  <td>
                    <code>{wh.id}</code>
                  </td>
                  <td>
                    <strong>{wh.url}</strong>
                  </td>
                  <td>
                    {wh.events.map((e) => (
                      <span key={e} className={styles.badgePill} style={{ marginRight: "4px" }}>
                        {e}
                      </span>
                    ))}
                  </td>
                  <td>
                    <code>{wh.secretMasked}</code>
                  </td>
                  <td>
                    <StatusBadge status="SUCCEEDED" customLabel={wh.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
