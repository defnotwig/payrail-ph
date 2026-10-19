#!/usr/bin/env node

/**
 * PayRail PH — Demo Merchant Provisioning Utility
 *
 * Provisions or verifies the dedicated demo merchant API key for the public sandbox checkout demo.
 * Securely hashes the plaintext key with SHA-256 before inserting into PostgreSQL.
 * NEVER prints plaintext keys to production logs and NEVER writes keys to disk.
 *
 * Usage:
 *   pnpm demo:merchant:provision
 *   pnpm demo:merchant:provision --check
 *   pnpm demo:merchant:provision --key sk_test_...
 *   pnpm demo:merchant:provision --merchant-id merchant_default
 */

import * as crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { Pool } = require("pg");

function parseArgs(argv) {
  const args = {
    checkOnly: false,
    key: process.env.DEMO_MERCHANT_API_KEY || null,
    merchantId: process.env.DEMO_MERCHANT_ID || "merchant_default",
    name: "PayRail Demo Sandbox Key",
    scopes: ["payments:read", "payments:write"],
    rotate: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") {
      args.checkOnly = true;
    } else if (arg === "--rotate") {
      args.rotate = true;
    } else if (arg === "--key" && argv[i + 1]) {
      args.key = argv[++i];
    } else if (arg === "--merchant-id" && argv[i + 1]) {
      args.merchantId = argv[++i];
    } else if (arg === "--name" && argv[i + 1]) {
      args.name = argv[++i];
    } else if (arg === "--scopes" && argv[i + 1]) {
      args.scopes = argv[++i].split(",").map((s) => s.trim());
    }
  }

  return args;
}

function maskKey(key) {
  if (!key || key.length < 16) return "sk_test_***";
  const prefix = key.slice(0, 8); // "sk_test_"
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const connectionString =
    process.env.DATABASE_URL || "postgresql://payrail@127.0.0.1:55432/payrail_local";

  const pool = new Pool({
    connectionString,
    max: 2,
    ssl:
      process.env.DATABASE_SSL === "true" || connectionString.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
  });

  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    console.error(`[Provisioning Error] Database connection failed: ${err.message}`);
    process.exit(1);
  }

  try {
    if (args.checkOnly) {
      console.log(`[Demo Merchant Provisioning] Checking demo merchant keys in database...`);
      const res = await pool.query(
        `SELECT id, merchant_id, key_prefix, key_hash, name, scopes, environment, created_at, revoked_at
         FROM payrail_private.merchant_api_keys
         WHERE merchant_id = $1 AND environment = 'test'
         ORDER BY created_at DESC`,
        [args.merchantId],
      );

      if (res.rows.length === 0) {
        console.warn(`[Check] No demo merchant keys found for merchant '${args.merchantId}'.`);
        process.exit(1);
      }

      console.log(`[Check] Found ${res.rows.length} key(s) for merchant '${args.merchantId}':`);
      for (const row of res.rows) {
        const status = row.revoked_at ? "REVOKED" : "ACTIVE";
        console.log(`  - ID: ${row.id}`);
        console.log(`    Status:      ${status}`);
        console.log(`    Name:        ${row.name}`);
        console.log(`    Key Prefix:  ${row.key_prefix}`);
        console.log(`    SHA-256:     ${row.key_hash.slice(0, 16)}...${row.key_hash.slice(-8)}`);
        console.log(`    Scopes:      ${JSON.stringify(row.scopes)}`);
        console.log(`    Created:     ${row.created_at.toISOString()}`);
      }

      if (args.key) {
        const hash = crypto.createHash("sha256").update(args.key).digest("hex");
        const match = res.rows.find((r) => r.key_hash === hash && !r.revoked_at);
        if (match) {
          console.log(`\n✓ Provided key matches active database record (ID: ${match.id}).`);
        } else {
          console.error(`\n✗ Provided key does NOT match any active database record.`);
          process.exit(1);
        }
      }
      return;
    }

    // Generate or use provided key
    let plaintextKey = args.key;
    let isGenerated = false;

    if (!plaintextKey || args.rotate) {
      const entropy = crypto.randomBytes(24).toString("base64url");
      plaintextKey = `sk_test_${entropy}`;
      isGenerated = true;
    }

    if (!/^sk_test_[a-zA-Z0-9_-]{16,64}$/.test(plaintextKey)) {
      console.error(
        `[Provisioning Error] Invalid API key format. Must match /^sk_test_[a-zA-Z0-9_-]{16,64}$/`,
      );
      process.exit(1);
    }

    const keyHash = crypto.createHash("sha256").update(plaintextKey).digest("hex");
    const keyPrefix = "sk_test_";

    const insertResult = await pool.query(
      `INSERT INTO payrail_private.merchant_api_keys
         (merchant_id, key_prefix, key_hash, name, scopes, environment)
       VALUES ($1, $2, $3, $4, $5, 'test')
       ON CONFLICT (key_hash) DO UPDATE SET
         revoked_at = NULL,
         expires_at = NULL,
         scopes = EXCLUDED.scopes,
         name = EXCLUDED.name
       RETURNING id, merchant_id, key_prefix, name, scopes, environment, created_at`,
      [args.merchantId, keyPrefix, keyHash, args.name, args.scopes],
    );

    const record = insertResult.rows[0];

    console.log(`\n======================================================`);
    console.log(`PayRail PH — Demo Merchant API Key Provisioned`);
    console.log(`======================================================`);
    console.log(`Record ID:    ${record.id}`);
    console.log(`Merchant ID:  ${record.merchant_id}`);
    console.log(`Key Name:     ${record.name}`);
    console.log(`Key Prefix:   ${record.key_prefix}`);
    console.log(`Masked Key:   ${maskKey(plaintextKey)}`);
    console.log(`SHA-256 Hash: ${keyHash}`);
    console.log(`Scopes:       ${JSON.stringify(record.scopes)}`);
    console.log(`Environment:  ${record.environment}`);
    console.log(`Status:       ACTIVE`);
    console.log(`======================================================\n`);

    if (isGenerated) {
      console.log(`ATTENTION: This plaintext key is displayed ONCE. Store it securely.`);
      console.log(`\n  DEMO_MERCHANT_API_KEY=${plaintextKey}\n`);
      console.log(`Vercel Configuration Instruction:`);
      console.log(`  Add DEMO_MERCHANT_API_KEY to your Vercel Project Environment Variables.`);
      console.log(`  Scope: Production & Preview.`);
      console.log(`  NEVER commit this secret to Git or push to public repositories.\n`);
    } else {
      console.log(`Active key hash successfully registered in database.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`Provisioning script failed: ${err.message}`);
  process.exit(1);
});
