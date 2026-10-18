import styles from "./ui.module.css";

interface AmountProps {
  amountMinor?: number | string | bigint;
  amountMajor?: number | string;
  currency?: string;
  align?: "left" | "right";
  className?: string;
}

const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

export function formatMinorToMajor(amountMinor: number | string | bigint): string {
  try {
    const minor = typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
    const sign = minor < ZERO ? "-" : "";
    const absolute = minor < ZERO ? -minor : minor;
    const whole = absolute / HUNDRED;
    const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
    return `${sign}${whole.toLocaleString("en-US")}.${fraction}`;
  } catch {
    return "0.00";
  }
}

export function Amount({
  amountMinor,
  amountMajor,
  currency = "PHP",
  align = "left",
  className = "",
}: AmountProps) {
  let displayValue = "0.00";
  if (amountMinor !== undefined && amountMinor !== null) {
    displayValue = formatMinorToMajor(amountMinor);
  } else if (amountMajor !== undefined && amountMajor !== null) {
    displayValue = typeof amountMajor === "number" ? amountMajor.toFixed(2) : amountMajor;
  }

  const symbol = currency === "PHP" ? "₱" : currency === "USD" ? "$" : `${currency} `;

  return (
    <span
      className={`${styles.amount} ${align === "right" ? styles.amountRight : ""} ${className}`}
    >
      <span className={styles.currencyPrefix} aria-hidden="true">
        {symbol}
      </span>
      <span>{displayValue}</span>
    </span>
  );
}
