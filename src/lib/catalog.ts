// Products for the demo store. Buying one in the sandbox creates a real
// PayPal order that a test buyer can then open a dispute on.

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "candle-lavender",
    name: "Lavender Dusk Candle",
    description: "Hand-poured soy candle, 8 oz, 45-hour burn",
    price: 24,
    emoji: "🕯️",
  },
  {
    id: "candle-cedar",
    name: "Cedar & Smoke Candle",
    description: "Wooden-wick soy candle, 12 oz, 60-hour burn",
    price: 36,
    emoji: "🌲",
  },
  {
    id: "gift-set",
    name: "Gift Set of Three",
    description: "Three 4 oz candles in a gift box",
    price: 60,
    emoji: "🎁",
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export type ShippingOutcome = "delivered" | "in_transit" | "returned";

/**
 * A realistic-looking USPS tracking number for demo shipments. The last digit
 * tells the simulated carrier (lib/agent/carrier.ts) what happened:
 * 0-6 delivered, 7-8 in transit, 9 returned to sender.
 */
export function fakeTrackingNumber(outcome: ShippingOutcome = "delivered"): string {
  let digits = "9400";
  for (let i = 0; i < 17; i++) digits += Math.floor(Math.random() * 10);
  const last = outcome === "delivered" ? Math.floor(Math.random() * 7) : outcome === "in_transit" ? 7 : 9;
  return digits + last;
}
