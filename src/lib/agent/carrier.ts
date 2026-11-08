// Simulated carrier tracking for the sandbox demo.
//
// PayPal stores the tracking number and marks the order SHIPPED, but sandbox
// tracking numbers are not real, so no carrier can tell us where the parcel
// went. This module plays the carrier: it derives a believable, repeatable
// scan history from the tracking number. Every result is flagged
// `simulated: true` and the UI labels it. In production this would call the
// carrier's API (USPS, UPS, FedEx) or a tracking aggregator instead.

export type CarrierStatus = "DELIVERED" | "IN_TRANSIT" | "EXCEPTION";

export interface CarrierEvent {
  time: string;
  description: string;
  location: string;
}

export interface CarrierTracking {
  trackingNumber: string;
  carrier: string;
  status: CarrierStatus;
  deliveredAt?: string;
  deliveredTo?: string;
  events: CarrierEvent[];
  simulated: true;
}

const MINUTE = 60_000;
// Scan times are compressed so the parcel is "delivered" ~3 minutes after
// payment, before a demo buyer can file a dispute.
const STEP = 0.5;

/**
 * The last digit of the tracking number decides the outcome:
 * 0-6 delivered, 7-8 still in transit, 9 lost / returned to sender.
 * Scan times are compressed (minutes, not days) so a demo order placed a
 * moment ago already has a full delivery history.
 */
export function lookupTracking(
  trackingNumber: string,
  shippedAt: string,
  destination: { city?: string; state?: string },
  carrier = "USPS",
): CarrierTracking {
  const lastDigit = Number(trackingNumber.slice(-1)) || 0;
  const status: CarrierStatus = lastDigit <= 6 ? "DELIVERED" : lastDigit <= 8 ? "IN_TRANSIT" : "EXCEPTION";
  const start = new Date(shippedAt).getTime();
  const at = (step: number) => new Date(start + step * STEP * MINUTE).toISOString();
  const dest = [destination.city, destination.state].filter(Boolean).join(", ") || "Destination";

  const events: CarrierEvent[] = [
    { time: at(1), description: "Shipping label created", location: "Portland, OR" },
    { time: at(2), description: "Accepted at USPS origin facility", location: "Portland, OR" },
    { time: at(3), description: "In transit to next facility", location: "Sacramento, CA" },
  ];

  if (status === "DELIVERED") {
    events.push(
      { time: at(4), description: "Arrived at post office", location: dest },
      { time: at(5), description: "Out for delivery", location: dest },
      { time: at(6), description: "Delivered, front door/porch", location: dest },
    );
    return {
      trackingNumber,
      carrier,
      status,
      deliveredAt: at(6),
      deliveredTo: dest,
      events,
      simulated: true,
    };
  }

  if (status === "EXCEPTION") {
    events.push(
      { time: at(4), description: "Delivery exception: address not found", location: dest },
      { time: at(6), description: "Returned to sender", location: "Sacramento, CA" },
    );
  }

  return { trackingNumber, carrier, status, events, simulated: true };
}
