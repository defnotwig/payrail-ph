import { OpsShell } from "./ops-shell";

export const metadata = {
  title: "PayRail PH — Operations Platform",
  description:
    "Internal payment operations, double-entry ledger, reconciliation, and reliability console.",
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsShell>{children}</OpsShell>;
}
