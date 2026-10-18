"use client";

import { useState, type ReactNode } from "react";
import styles from "./ui.module.css";

export interface DetailItem {
  label: string;
  value: ReactNode;
  copyableText?: string;
}

interface DetailListProps {
  items: DetailItem[];
  className?: string;
}

export function DetailList({ items, className = "" }: DetailListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  };

  return (
    <dl className={`${styles.detailList} ${className}`}>
      {items.map((item, idx) => (
        <div key={item.label} className={styles.detailRow}>
          <dt className={styles.detailKey}>{item.label}</dt>
          <dd className={styles.detailValue}>
            <span>{item.value}</span>
            {item.copyableText ? (
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => {
                  if (item.copyableText) {
                    handleCopy(item.copyableText, idx);
                  }
                }}
                title="Copy to clipboard"
                aria-label={`Copy ${item.label}`}
              >
                {copiedIndex === idx ? "✓ Copied" : "Copy"}
              </button>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
