"use client";

import { useState } from "react";
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
        "SSRF Security Violation: Outbound webhook endpoints cannot point to loopback, RFC 1918 private subnets, or AWS metadata addresses (169.254.169.254).",
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
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>Merchant API Platform & Outbound Webhooks</h1>
            <p className={styles.pageSubtitle}>
              Cryptographically hashed API key credentials (SHA-256) and SSRF-hardened HMAC-signed
              outbound webhooks.
            </p>
          </div>
          <button type="button" className={styles.buttonPrimary} onClick={handleCreateKey}>
            + Generate New API Key
          </button>
        </div>
      </div>

      {createdPlainKey && (
        <div
          className={styles.card}
          style={{ border: "1px solid #10b981", background: "rgba(16, 185, 129, 0.05)" }}
        >
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle} style={{ color: "#34d399" }}>
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
          <p style={{ fontSize: "13px", color: "#cbd5e1" }}>
            Copy this key now. For PCI and security compliance,{" "}
            <b>we do not store the plaintext key</b> in our database (only the SHA-256 digest is
            stored).
          </p>
          <div className={styles.codeBlock} style={{ color: "#34d399" }}>
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
                  <th>Name / ID</th>
                  <th>Key Prefix</th>
                  <th>Scopes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <div>
                        <b>{key.name}</b>
                      </div>
                      <code style={{ fontSize: "11px", color: "#64748b" }}>{key.id}</code>
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
                      <span className={styles.badgeSuccess}>ACTIVE</span>
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
            <span className={styles.badgeSuccess}>SSRF HARDENED</span>
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
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "6px",
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
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid #ef4444",
                  padding: "8px",
                  borderRadius: "6px",
                  color: "#f87171",
                  fontSize: "12px",
                }}
              >
                {ssrfError}
              </div>
            )}
            <button type="submit" className={styles.buttonPrimary}>
              Register Webhook Endpoint
            </button>
          </form>

          <div style={{ marginTop: "16px", borderTop: "1px solid #232f48", paddingTop: "12px" }}>
            <h3 style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 6px 0" }}>
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
                <th>Endpoint ID</th>
                <th>Target URL</th>
                <th>Subscribed Events</th>
                <th>Signing Secret</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh) => (
                <tr key={wh.id}>
                  <td>
                    <code>{wh.id}</code>
                  </td>
                  <td>
                    <b>{wh.url}</b>
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
                    <span className={styles.badgeSuccess}>{wh.status}</span>
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
