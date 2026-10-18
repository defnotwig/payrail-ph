"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./ops.module.css";

interface NavItem {
  name: string;
  href: string;
  exact?: boolean;
}

const navigation: NavItem[] = [
  { name: "Overview", href: "/ops", exact: true },
  { name: "Transactions & Intents", href: "/ops/transactions" },
  { name: "Double-Entry Ledger", href: "/ops/ledger" },
  { name: "Refunds", href: "/ops/refunds" },
  { name: "Reconciliation", href: "/ops/reconciliation" },
  { name: "Durable Jobs & DLQ", href: "/ops/jobs" },
  { name: "Merchant API & Webhooks", href: "/ops/developer" },
  { name: "Cards & 3DS", href: "/ops/cards" },
  { name: "Reliability Lab (Chaos)", href: "/ops/reliability-lab" },
  { name: "ISO 8583 Protocol Lab", href: "/ops/iso8583" },
];

export function OpsNav() {
  const pathname = usePathname();

  const isCurrent = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname?.startsWith(`${item.href}/`);
  };

  return (
    <nav className={styles.navTabs} aria-label="Operations Navigation">
      {navigation.map((item) => {
        const active = isCurrent(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navTab} ${active ? styles.navTabActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
