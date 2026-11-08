// Turns raw PayPal objects into one plain "case file": the facts the AI is
// allowed to reason about. Nothing in here calls an AI; it only collects,
// cleans and labels data, so every claim in the final letter traces back to
// a PayPal record (or to the clearly labelled simulated carrier scan).

import type { Capture, Dispute, Money, Order } from "../paypal-types";
import { lookupTracking, type CarrierTracking } from "./carrier";

export interface CaseFile {
  disputeId: string;
  reason: string;
  status: string;
  lifecycleStage?: string;
  amount: Money;
  openedAt: string;
  respondBy?: string;
  buyer: { name?: string; email?: string };
  buyerClaims: { date?: string; text: string }[];
  buyerRequestedRefund?: Money;
  buyerContactedSellerFirst?: boolean;
  sellerProtectionEligible?: boolean;
  sellerProtectionType?: string;
  payment: { transactionId?: string; paidAt?: string; amount?: Money; status?: string };
  order: { id: string; items: { name: string; quantity: string; unitPrice: Money }[] } | null;
  shipping: { recipient?: string; address?: string; city?: string; state?: string; country?: string } | null;
  tracking: CarrierTracking[];
  /** Plain-language facts worked out in code, given to the AI as hints. */
  signals: string[];
}

export function buildCaseFile(
  dispute: Dispute,
  capture: Capture | null,
  order: Order | null,
): CaseFile {
  const txn = dispute.disputed_transactions?.[0];
  const unit = order?.purchase_units?.[0];
  const addr = unit?.shipping?.address;
  const paidAt = txn?.create_time ?? capture?.create_time;

  const buyerClaims = [
    ...(dispute.evidences ?? [])
      .filter((e) => e.source === "SUBMITTED_BY_BUYER" && e.notes)
      .map((e) => ({ date: e.date, text: e.notes! })),
    ...(dispute.messages ?? [])
      .filter((m) => m.posted_by === "BUYER" && m.content)
      .map((m) => ({ date: m.time_posted, text: m.content })),
  ];

  const shipping = unit?.shipping
    ? {
        recipient: unit.shipping.name?.full_name,
        address: [addr?.address_line_1, addr?.address_line_2, addr?.admin_area_2, addr?.admin_area_1, addr?.postal_code, addr?.country_code]
          .filter(Boolean)
          .join(", "),
        city: addr?.admin_area_2,
        state: addr?.admin_area_1,
        country: addr?.country_code,
      }
    : null;

  // PayPal tracker ids look like "<capture_id>-<tracking_number>".
  const tracking = (unit?.shipping?.trackers ?? []).map((t) => {
    const number = t.id.split("-").slice(1).join("-");
    return lookupTracking(number, paidAt ?? dispute.create_time, { city: addr?.admin_area_2, state: addr?.admin_area_1 });
  });

  const caseFile: CaseFile = {
    disputeId: dispute.dispute_id,
    reason: dispute.reason,
    status: dispute.status,
    lifecycleStage: dispute.dispute_life_cycle_stage,
    amount: dispute.dispute_amount,
    openedAt: dispute.create_time,
    respondBy: dispute.seller_response_due_date,
    buyer: { name: txn?.buyer?.name, email: txn?.buyer?.email },
    buyerClaims,
    buyerRequestedRefund: dispute.offer?.buyer_requested_amount,
    buyerContactedSellerFirst: dispute.extensions?.merchant_contacted,
    sellerProtectionEligible: txn?.seller_protection_eligible,
    sellerProtectionType: txn?.seller_protection_type,
    payment: {
      transactionId: txn?.seller_transaction_id ?? capture?.id,
      paidAt,
      amount: txn?.gross_amount ?? capture?.amount,
      status: txn?.transaction_status ?? capture?.status,
    },
    order: order
      ? {
          id: order.id,
          items: (unit?.items ?? []).map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_amount })),
        }
      : null,
    shipping,
    tracking,
    signals: [],
  };
  caseFile.signals = deriveSignals(caseFile);
  return caseFile;
}

function deriveSignals(c: CaseFile): string[] {
  const s: string[] = [];
  const delivered = c.tracking.find((t) => t.status === "DELIVERED");

  if (c.tracking.length === 0) s.push("No tracking number is attached to this order.");
  if (delivered) {
    s.push(`Carrier shows the parcel DELIVERED on ${delivered.deliveredAt} to ${delivered.deliveredTo}.`);
    if (c.shipping?.city && delivered.deliveredTo?.startsWith(c.shipping.city)) {
      s.push("Delivery city matches the shipping address on the PayPal order.");
    }
  }
  const inTransit = c.tracking.find((t) => t.status === "IN_TRANSIT");
  if (inTransit) s.push("Carrier shows the parcel still IN TRANSIT; it has not been delivered yet.");
  const exception = c.tracking.find((t) => t.status === "EXCEPTION");
  if (exception) s.push("Carrier reported a delivery EXCEPTION and the parcel was returned to sender.");

  if (c.sellerProtectionEligible) {
    s.push(`PayPal marks this payment as eligible for Seller Protection (${c.sellerProtectionType ?? "type not given"}).`);
  }
  if (c.buyerContactedSellerFirst === false) {
    s.push("Buyer did not contact the seller before opening the dispute.");
  }
  if (c.buyerClaims.length === 0) s.push("Buyer gave no written explanation, only a reason code.");
  if (c.payment.paidAt) {
    const hours = (new Date(c.openedAt).getTime() - new Date(c.payment.paidAt).getTime()) / 3_600_000;
    if (hours >= 0 && hours < 24 * 3) {
      s.push(`Dispute opened ${hours < 1 ? "less than an hour" : `${Math.round(hours)} hours`} after payment.`);
    }
  }
  return s;
}
