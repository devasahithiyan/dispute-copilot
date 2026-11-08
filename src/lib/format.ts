import type { Money } from "./paypal-types";

export function money(m?: Money): string {
  if (!m) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency_code }).format(
    Number(m.value),
  );
}

export function usd(value: number): string {
  return money({ currency_code: "USD", value: String(value) });
}

export function date(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function shortDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "3 min ago", "2 h ago", "4 days ago" */
export function ago(iso?: string): string {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" -> "Merchandise or service not received" */
export function humanize(code?: string): string {
  if (!code) return "—";
  const s = code.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Short, friendly labels for PayPal dispute reasons. */
export function reasonLabel(reason?: string): string {
  switch (reason) {
    case "MERCHANDISE_OR_SERVICE_NOT_RECEIVED":
      return "Item not received";
    case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
      return "Not as described";
    case "UNAUTHORISED":
      return "Unauthorized payment";
    case "CREDIT_NOT_PROCESSED":
      return "Credit not processed";
    case "DUPLICATE_TRANSACTION":
      return "Duplicate charge";
    case "INCORRECT_AMOUNT":
      return "Incorrect amount";
    default:
      return humanize(reason);
  }
}

export function statusLabel(status?: string): string {
  switch (status) {
    case "WAITING_FOR_SELLER_RESPONSE":
      return "Needs your response";
    case "WAITING_FOR_BUYER_RESPONSE":
      return "Waiting on buyer";
    case "UNDER_REVIEW":
      return "PayPal reviewing";
    case "RESOLVED":
      return "Resolved";
    case "OPEN":
      return "Open";
    default:
      return humanize(status);
  }
}

export function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
