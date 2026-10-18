"use client";

import { useState } from "react";
import styles from "../ops.module.css";

interface IsoField {
  number: number;
  name: string;
  value: string;
  raw: string;
  desc: string;
}

export default function Iso8583LabPage() {
  const [mti, setMti] = useState<"0200" | "0210" | "0400">("0200");
  const [amount, setAmount] = useState("500.00");
  const [stan, setStan] = useState("123456");
  const [terminalId, setTerminalId] = useState("TERM0001");
  const [rawWireHex, _setRawWireHex] = useState(
    "30323030373233383030303030303030303030303030303030303035303030303130313831373330303031323334353631373330303031303138353339395041595241494c54455354315445524d303030315041595241494c4d455243483030313630383032325245463d5041595241494c5445535431",
  );

  const parsedFields: IsoField[] = [
    {
      number: 3,
      name: "Processing Code",
      value: "000000",
      raw: "000000",
      desc: "Purchase / Goods & Services",
    },
    {
      number: 4,
      name: "Amount, Transaction",
      value: (parseFloat(amount || "0") * 100).toFixed(0).padStart(12, "0"),
      raw: (parseFloat(amount || "0") * 100).toFixed(0).padStart(12, "0"),
      desc: `₱${amount} PHP (12 numeric digits in minor units)`,
    },
    {
      number: 7,
      name: "Transmission Date/Time",
      value: "1018173000",
      raw: "1018173000",
      desc: "MMDDhhmmss (Oct 18, 17:30:00 UTC+8)",
    },
    {
      number: 11,
      name: "Systems Trace Audit Number (STAN)",
      value: stan.padStart(6, "0"),
      raw: stan.padStart(6, "0"),
      desc: "Unique 6-digit transaction audit trace",
    },
    {
      number: 12,
      name: "Time, Local Transaction",
      value: "173000",
      raw: "173000",
      desc: "hhmmss local switch time",
    },
    {
      number: 13,
      name: "Date, Local Transaction",
      value: "1018",
      raw: "1018",
      desc: "MMDD local switch date",
    },
    {
      number: 18,
      name: "Merchant Category Code (MCC)",
      value: "5399",
      raw: "5399",
      desc: "Misc General Merchandise",
    },
    {
      number: 37,
      name: "Retrieval Reference Number (RRN)",
      value: "PAYRAILTEST1",
      raw: "PAYRAILTEST1",
      desc: "12-char acquirer reference",
    },
    ...(mti === "0210"
      ? [
          {
            number: 39,
            name: "Response Code",
            value: "00",
            raw: "00",
            desc: "00 = Approved by Issuer / Switch",
          },
        ]
      : []),
    {
      number: 41,
      name: "Card Acceptor Terminal ID",
      value: terminalId.padEnd(8, " "),
      raw: terminalId.padEnd(8, " "),
      desc: "Terminal hardware identifier",
    },
    {
      number: 42,
      name: "Card Acceptor ID Code",
      value: "PAYRAILMERCH001",
      raw: "PAYRAILMERCH001",
      desc: "Acquirer merchant code",
    },
    {
      number: 49,
      name: "Currency Code, Transaction",
      value: "608",
      raw: "608",
      desc: "ISO 4217 Numeric: 608 = Philippine Peso (PHP)",
    },
    {
      number: 62,
      name: "Private Field / QR Ph Reference",
      value: "REF=PAYRAILTEST1",
      raw: "022REF=PAYRAILTEST1",
      desc: "QR Ph EMVCo payload reference pointer",
    },
  ];

  return (
    <div>
      <div className={styles.headerSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className={styles.pageTitle}>ISO 8583 Financial Message Protocol Lab</h1>
            <p className={styles.pageSubtitle}>
              Interactive ISO 8583 message packer, unpacker, primary bitmap analyzer, and financial
              field mapper.
            </p>
          </div>
          <span className={styles.badgePill}>ISO 8583:1987 / 1993 STANDARD</span>
        </div>
      </div>

      <div className={styles.gridTwoCol}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Message Type & Attributes</h2>
            <span className={styles.badgeSuccess}>0200 / 0210 READY</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label
                htmlFor="mti-select"
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Message Type Identifier (MTI)
              </label>
              <select
                id="mti-select"
                className={styles.inputField}
                value={mti}
                onChange={(e) => setMti(e.target.value as "0200" | "0210" | "0400")}
              >
                <option value="0200">0200 — Financial Transaction Request (Purchase)</option>
                <option value="0210">
                  0210 — Financial Transaction Response (Issuer Approval)
                </option>
                <option value="0400">0400 — Reversal Request (Transaction Cancelled)</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label
                  htmlFor="amount-input"
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  Amount (PHP)
                </label>
                <input
                  id="amount-input"
                  type="text"
                  className={styles.inputField}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="stan-input"
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    display: "block",
                    marginBottom: "6px",
                  }}
                >
                  STAN (6 digits)
                </label>
                <input
                  id="stan-input"
                  type="text"
                  className={styles.inputField}
                  value={stan}
                  onChange={(e) => setStan(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="terminal-id-input"
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
                Terminal ID
              </label>
              <input
                id="terminal-id-input"
                type="text"
                className={styles.inputField}
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>64-Bit Primary Bitmap Analysis</h2>
            <span className={styles.badgePill}>HEX: 7238000000000000</span>
          </div>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 12px 0" }}>
            The 64-bit bitmap dictates which Data Elements (DE) are active in the payload. Active
            bits indicate field presence.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "4px",
              background: "#090d16",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #1e293b",
            }}
          >
            {Array.from({ length: 64 }, (_, i) => {
              const fieldNum = i + 1;
              const isActive = parsedFields.some((f) => f.number === fieldNum);
              return (
                <div
                  key={fieldNum}
                  style={{
                    padding: "4px",
                    textAlign: "center",
                    fontSize: "11px",
                    borderRadius: "3px",
                    background: isActive ? "rgba(59, 130, 246, 0.3)" : "rgba(255, 255, 255, 0.03)",
                    color: isActive ? "#60a5fa" : "#475569",
                    border: isActive ? "1px solid #3b82f6" : "1px solid transparent",
                    fontWeight: isActive ? 600 : 400,
                  }}
                  title={`Field ${fieldNum}: ${isActive ? "PRESENT" : "ABSENT"}`}
                >
                  {fieldNum}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Parsed Data Elements (DE)</h2>
          <span className={styles.badgeSuccess}>{parsedFields.length} FIELDS PACKED</span>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>DE #</th>
                <th>Field Name</th>
                <th>Unpacked Value</th>
                <th>Wire Encoding</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {parsedFields.map((field) => (
                <tr key={field.number}>
                  <td>
                    <b>DE {field.number}</b>
                  </td>
                  <td>{field.name}</td>
                  <td>
                    <code style={{ color: "#38bdf8" }}>{field.value}</code>
                  </td>
                  <td>
                    <code>{field.raw}</code>
                  </td>
                  <td style={{ color: "#94a3b8" }}>{field.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Simulated Network Wire Representation (Hex Stream)</h2>
          <span className={styles.badgePill}>TCP/IP SOCKET READY</span>
        </div>
        <div className={styles.codeBlock}>{rawWireHex}</div>
      </div>
    </div>
  );
}
