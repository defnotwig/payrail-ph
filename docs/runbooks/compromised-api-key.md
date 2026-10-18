# Runbook: Compromised Merchant API Key & Emergency Revocation

## Severity: P1 (High Security)
## Trigger
Merchant report of leaked credentials on GitHub or anomaly detection flagging suspicious IP traffic using an active API key.

## Immediate Emergency Revocation (Zero-Downtime)
1. **Revoke the Compromised Key Immediately:**
   Execute immediate revocation via API or direct SQL:
   ```sql
   UPDATE payrail_private.merchant_api_keys
   SET revoked_at = clock_timestamp()
   WHERE id = '<TARGET_KEY_ID>' AND merchant_id = '<MERCHANT_ID>';
   ```
2. **Confirm Revocation Invalidation:**
   Any request using the revoked key will immediately receive `401 Unauthorized` ("Invalid, expired, or revoked API key").
3. **Audit Past Actions by Compromised Key:**
   ```sql
   SELECT id, actor_id, action, resource_type, resource_id, metadata, ip_address, created_at
   FROM payrail_private.audit_events
   WHERE actor_type = 'API_KEY' AND actor_id = '<TARGET_KEY_ID>'
   ORDER BY created_at DESC LIMIT 100;
   ```
4. **Issue New Key to Merchant:**
   Generate a new API key via `MerchantKeysService.createApiKey` and transmit the plaintext key securely to the verified merchant contact.
