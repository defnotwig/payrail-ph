"use client";

import { useEffect, useState } from "react";
import { PageHeader, Skeleton, StatusBadge } from "../../../components/ui";
import styles from "../ops.module.css";

interface ApiKeyRecord {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  environment: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

interface WebhookEndpointRecord {
  id: string;
  url: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
}

interface WebhookDeliveryRecord {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  status: string;
  statusCode?: number;
  attemptCount: number;
  createdAt: string;
}

interface DeveloperResponse {
  data?: {
    keys?: ApiKeyRecord[];
    webhooks?: WebhookEndpointRecord[];
    deliveries?: WebhookDeliveryRecord[];
  };
}

export default function DeveloperPlatformPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpointRecord[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRecord[]>([]);

  const fetchDeveloperData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/ops/developer");
      if (!res.ok) {
        throw new Error(`Developer service returned HTTP ${res.status}`);
      }
      const json: DeveloperResponse = await res.json();
      setApiKeys(json.data?.keys || []);
      setWebhooks(json.data?.webhooks || []);
      setDeliveries(json.data?.deliveries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load developer platform records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeveloperData();
  }, []);

  return (
    <div>
      <PageHeader
        title="Developer Platform & API Credentials"
        subtitle="Cryptographically hashed API secrets, scoped permissions, and outward merchant webhook dispatchers with SSRF isolation."
        actions={<StatusBadge status="SUCCEEDED" customLabel="SHA-256 HASHED SECRETS" />}
      />

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          <strong>Developer Platform Notice:</strong> {error}
        </div>
      )}

      {/* API Keys Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Merchant API Keys (payrail_private.merchant_api_keys)
          </h2>
          <span className={styles.badgePill}>SCOPED SECRETS</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Key Name</th>
                <th scope="col">Prefix</th>
                <th scope="col">Scopes</th>
                <th scope="col">Environment</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "20px" }}>
                    <Skeleton height="36px" />
                  </td>
                </tr>
              ) : apiKeys.length > 0 ? (
                apiKeys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <strong>{key.name}</strong>
                    </td>
                    <td>
                      <code>{key.keyPrefix}••••••••</code>
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
                      <span className={styles.badgePill}>{key.environment.toUpperCase()}</span>
                    </td>
                    <td>
                      <StatusBadge
                        status={key.revokedAt ? "FAILED" : "SUCCEEDED"}
                        customLabel={key.revokedAt ? "REVOKED" : "ACTIVE"}
                      />
                    </td>
                    <td>{new Date(key.createdAt).toLocaleString("en-PH")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "32px", color: "#64748b" }}
                  >
                    No API keys registered in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outbound Webhook Subscriptions */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Outbound Webhook Endpoints (payrail_private.merchant_webhook_endpoints)
          </h2>
          <span className={styles.badgePill}>AES-256-GCM SIGNED</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Endpoint URL</th>
                <th scope="col">Subscribed Events</th>
                <th scope="col">Status</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: "20px" }}>
                    <Skeleton height="36px" />
                  </td>
                </tr>
              ) : webhooks.length > 0 ? (
                webhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td>
                      <code>{wh.url}</code>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {wh.subscribedEvents.map((evt) => (
                          <span key={evt} className={styles.badgePill} style={{ fontSize: "10px" }}>
                            {evt}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        status={wh.isActive ? "SUCCEEDED" : "FAILED"}
                        customLabel={wh.isActive ? "ACTIVE" : "DISABLED"}
                      />
                    </td>
                    <td>{new Date(wh.createdAt).toLocaleString("en-PH")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: "center", padding: "36px 20px", color: "#64748b" }}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>🔔</div>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                      No Merchant Webhooks Configured
                    </div>
                    <p style={{ margin: 0, fontSize: "12.5px" }}>
                      Merchant webhook dispatch enforces private subnet filtering (SSRF protection),
                      HTTPS requirement, and HMAC-SHA256 signature verification.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Webhook Deliveries */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Recent Delivery Attempts (payrail_private.merchant_webhook_deliveries)
          </h2>
          <span className={styles.badgePill}>DISPATCH AUDIT</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Delivery ID</th>
                <th scope="col">Event Type</th>
                <th scope="col">Status</th>
                <th scope="col">HTTP Code</th>
                <th scope="col">Attempts</th>
                <th scope="col">Dispatched At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "20px" }}>
                    <Skeleton height="36px" />
                  </td>
                </tr>
              ) : deliveries.length > 0 ? (
                deliveries.map((del) => (
                  <tr key={del.id}>
                    <td>
                      <code>{del.id.substring(0, 16)}...</code>
                    </td>
                    <td>
                      <code>{del.eventType}</code>
                    </td>
                    <td>
                      <StatusBadge
                        status={del.status === "DELIVERED" ? "SUCCEEDED" : "FAILED"}
                        customLabel={del.status}
                      />
                    </td>
                    <td>{del.statusCode ? <code>{del.statusCode}</code> : "—"}</td>
                    <td>{del.attemptCount}</td>
                    <td>{new Date(del.createdAt).toLocaleString("en-PH")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "32px", color: "#64748b" }}
                  >
                    No outbound webhook deliveries dispatched yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
