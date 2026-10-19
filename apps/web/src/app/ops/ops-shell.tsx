"use client";

import type React from "react";
import { useState } from "react";
import { OpsSidebar } from "./ops-sidebar";
import { OpsHeader } from "./ops-header";
import styles from "./ops.module.css";

export function OpsShell({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className={styles.appLayout}>
      <OpsSidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />
      <div className={styles.appContentArea}>
        <OpsHeader onToggleMobileSidebar={() => setIsMobileOpen((prev) => !prev)} />
        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
