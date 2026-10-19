"use client";

import type React from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./global-search-modal.module.css";

export interface SearchResultItem {
  type: "page" | "payment" | "refund" | "ledger" | "webhook" | "job" | "reconciliation";
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  href: string;
  timestamp?: string;
}

export interface SearchResultsGrouped {
  query: string;
  payments: SearchResultItem[];
  refunds: SearchResultItem[];
  ledger: SearchResultItem[];
  webhooks: SearchResultItem[];
  jobs: SearchResultItem[];
  reconciliation: SearchResultItem[];
}

interface LocalPageItem {
  id: string;
  title: string;
  category: string;
  href: string;
  keywords: string[];
}

const LOCAL_PAGES: LocalPageItem[] = [
  {
    id: "overview",
    title: "Operations Overview",
    category: "Navigation",
    href: "/ops",
    keywords: ["home", "dashboard", "metrics", "stats"],
  },
  {
    id: "payments",
    title: "Payments & Orders",
    category: "Navigation",
    href: "/ops/transactions",
    keywords: ["transactions", "intents", "qrph", "checkout"],
  },
  {
    id: "refunds",
    title: "Refunds & Adjustments",
    category: "Navigation",
    href: "/ops/refunds",
    keywords: ["reversals", "chargebacks", "money"],
  },
  {
    id: "ledger",
    title: "Double-Entry Ledger",
    category: "Navigation",
    href: "/ops/ledger",
    keywords: ["journal", "balance", "accounts", "debit", "credit"],
  },
  {
    id: "reconciliation",
    title: "3-Way Reconciliation",
    category: "Navigation",
    href: "/ops/reconciliation",
    keywords: ["discrepancy", "audit", "run", "batch"],
  },
  {
    id: "webhooks",
    title: "Webhooks & API Keys",
    category: "Navigation",
    href: "/ops/developer",
    keywords: ["developer", "events", "endpoints", "signatures", "secrets"],
  },
  {
    id: "jobs",
    title: "Durable Jobs & DLQ",
    category: "Navigation",
    href: "/ops/jobs",
    keywords: ["workers", "dead letter", "replay", "tasks", "queue"],
  },
  {
    id: "cards",
    title: "Cards & 3D Secure",
    category: "Navigation",
    href: "/ops/cards",
    keywords: ["visa", "mastercard", "3ds", "card payments"],
  },
  {
    id: "reliability",
    title: "Reliability Lab (Chaos)",
    category: "Navigation",
    href: "/ops/reliability-lab",
    keywords: ["chaos", "circuit breaker", "latency", "fault injection"],
  },
  {
    id: "iso8583",
    title: "ISO 8583 Message Lab",
    category: "Navigation",
    href: "/ops/iso8583",
    keywords: ["switch", "bitmap", "atm", "pos", "banking protocol"],
  },
  {
    id: "demo-qrph",
    title: "Demo: QR Ph Checkout",
    category: "Simulators",
    href: "/demo/qrph",
    keywords: ["paymongo", "sandbox", "test qr"],
  },
];

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, startTransition] = useTransition();
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteResults, setRemoteResults] = useState<SearchResultsGrouped | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Focus input automatically on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setRemoteResults(null);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  // Compute matched local pages instantly (<1ms)
  const matchedPages: SearchResultItem[] = query.trim()
    ? LOCAL_PAGES.filter((p) => {
        const q = query.toLowerCase().trim();
        return (
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.keywords.some((k) => k.toLowerCase().includes(q))
        );
      }).map((p) => ({
        type: "page",
        id: p.id,
        title: p.title,
        subtitle: p.category,
        href: p.href,
      }))
    : LOCAL_PAGES.slice(0, 5).map((p) => ({
        type: "page",
        id: p.id,
        title: p.title,
        subtitle: p.category,
        href: p.href,
      }));

  // Debounced server search (180ms) with request cancellation
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteResults(null);
      setIsLoadingRemote(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      setIsLoadingRemote(true);
      try {
        const res = await fetch(`/api/ops/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const json = await res.json();
        setRemoteResults(json.data || null);
      } catch (err: unknown) {
        if ((err as { name?: string }).name !== "AbortError") {
          setRemoteResults(null);
        }
      } finally {
        setIsLoadingRemote(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Flatten all visible items for sequential arrow keyboard navigation
  const flatItems: SearchResultItem[] = [
    ...matchedPages,
    ...(remoteResults?.payments || []),
    ...(remoteResults?.refunds || []),
    ...(remoteResults?.ledger || []),
    ...(remoteResults?.webhooks || []),
    ...(remoteResults?.jobs || []),
    ...(remoteResults?.reconciliation || []),
  ];

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex]);

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    startTransition(() => {
      router.push(item.href);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Operations Quick Search"
    >
      <button
        type="button"
        className={styles.backdropOverlay}
        onClick={onClose}
        aria-label="Close dialog"
        tabIndex={-1}
      />
      <div className={styles.modal}>
        <div className={styles.inputContainer}>
          <svg
            className={styles.searchIcon}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11L14.5 14.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search payments (PRL-...), refunds, ledger, webhooks (evt_...)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="ops-search-results"
            aria-activedescendant={flatItems[selectedIndex]?.id || undefined}
          />
          {isLoadingRemote && (
            <span className={styles.loadingSpinner} role="status" aria-label="Loading results" />
          )}
          <button
            type="button"
            className={styles.escBadge}
            onClick={onClose}
            aria-label="Close search"
          >
            ESC
          </button>
        </div>

        <div id="ops-search-results" ref={listRef} className={styles.resultsList} role="listbox">
          {flatItems.length === 0 ? (
            <div className={styles.emptyState}>
              No operational records or pages match &ldquo;{query}&rdquo;
            </div>
          ) : (
            flatItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  id={item.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={`${styles.resultItem} ${isSelected ? styles.selectedItem : ""}`}
                  onClick={() => handleSelect(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(item);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className={styles.itemBadgeWrapper}>
                    <span className={`${styles.typeBadge} ${styles[`badge_${item.type}`]}`}>
                      {item.type.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles.itemDetails}>
                    <div className={styles.itemTitleRow}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      {item.status && (
                        <span
                          className={`${styles.statusPill} ${styles[`status_${item.status}`] || ""}`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                    {item.subtitle && <p className={styles.itemSubtitle}>{item.subtitle}</p>}
                  </div>
                  <span className={styles.enterHint} aria-hidden="true">
                    ↵
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.footerHint}>
          <span>
            Use <strong>↑</strong> <strong>↓</strong> to navigate
          </span>
          <span>
            <strong>↵</strong> to open
          </span>
          <span>
            <strong>ESC</strong> to close
          </span>
        </div>
      </div>
    </div>
  );
}
