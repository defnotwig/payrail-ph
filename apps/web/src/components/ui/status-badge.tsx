import styles from "./ui.module.css";

export type PaymentState =
  | "CREATED"
  | "SUBMISSION_PENDING"
  | "SUBMITTED"
  | "AWAITING_PAYMENT"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "UNKNOWN_REQUIRES_RECONCILIATION"
  | "UNKNOWN"
  | string;

interface StatusBadgeProps {
  status: PaymentState;
  customLabel?: string;
}

export function StatusBadge({ status, customLabel }: StatusBadgeProps) {
  let variantClass = styles.badgeDefault;
  let label = customLabel ?? status;

  switch (status) {
    case "SUCCEEDED":
    case "PAID":
    case "SETTLED":
    case "ACTIVE":
      variantClass = styles.badgeSucceeded;
      label = customLabel ?? "Succeeded";
      break;
    case "PROCESSING":
    case "AWAITING_PAYMENT":
    case "SUBMISSION_PENDING":
    case "SUBMITTED":
    case "PENDING":
      variantClass = styles.badgeProcessing;
      label = customLabel ?? (status === "AWAITING_PAYMENT" ? "Awaiting payment" : "Processing");
      break;
    case "FAILED":
    case "EXPIRED":
    case "REJECTED":
    case "DEAD_LETTER":
      variantClass = styles.badgeFailed;
      label = customLabel ?? (status === "EXPIRED" ? "Expired" : "Failed");
      break;
    case "UNKNOWN_REQUIRES_RECONCILIATION":
    case "UNKNOWN":
      variantClass = styles.badgeUnknown;
      label = customLabel ?? "Needs review";
      break;
    default:
      variantClass = styles.badgeDefault;
      break;
  }

  return (
    <span className={`${styles.badge} ${variantClass}`} role="status">
      <span className={styles.badgeDot} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
