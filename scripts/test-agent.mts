// Runs the AI agent on five hand-made dispute scenarios and prints a summary.
// Usage: npm run test:agent            (all scenarios)
//        npm run test:agent -- lost    (one scenario by key)

import { buildCaseFile } from "../src/lib/agent/case-file";
import { analyzeCase } from "../src/lib/agent/analyze";
import type { Dispute, Order } from "../src/lib/paypal-types";

const PAID_AT = "2026-11-01T10:00:00Z";
const usd = (value: string) => ({ currency_code: "USD", value });

function dispute(reason: string, note: string, extra: Partial<Dispute> = {}): Dispute {
  return {
    dispute_id: `PP-TEST-${reason.slice(0, 12)}`,
    create_time: "2026-11-08T09:00:00Z",
    update_time: "2026-11-08T09:00:00Z",
    reason,
    status: "WAITING_FOR_SELLER_RESPONSE",
    dispute_amount: usd("36.00"),
    dispute_life_cycle_stage: "INQUIRY",
    disputed_transactions: [
      {
        seller_transaction_id: "8TEST0000CAPTURE1",
        create_time: PAID_AT,
        gross_amount: usd("36.00"),
        buyer: { name: "Alex Rivera", email: "alex@example.com" },
        seller_protection_eligible: true,
        seller_protection_type: "EXPANDED_SELLER_PROTECTION",
      },
    ],
    evidences: note ? [{ source: "SUBMITTED_BY_BUYER", notes: note, date: "2026-11-08T09:00:00Z" }] : [],
    extensions: { merchant_contacted: false },
    ...extra,
  };
}

function order(trackingNumber?: string): Order {
  return {
    id: "5TESTORDER000001",
    status: "COMPLETED",
    purchase_units: [
      {
        items: [{ name: "Cedar & Smoke Candle", quantity: "1", unit_amount: usd("36.00") }],
        shipping: {
          name: { full_name: "Alex Rivera" },
          address: { address_line_1: "1 Main St", admin_area_2: "San Jose", admin_area_1: "CA", postal_code: "95131", country_code: "US" },
          trackers: trackingNumber ? [{ id: `8TEST0000CAPTURE1-${trackingNumber}`, status: "SHIPPED" }] : [],
        },
      },
    ],
  };
}

// Tracking numbers ending 0-6 = delivered, 7-8 = in transit, 9 = returned.
const SCENARIOS: Record<string, { expect: "FIGHT" | "REFUND"; dispute: Dispute; order: Order }> = {
  delivered: {
    expect: "FIGHT",
    dispute: dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "Never got my candle. Please refund."),
    order: order("9400100000000000000003"),
  },
  "no-tracking": {
    expect: "REFUND",
    dispute: dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "It has been two weeks and nothing arrived."),
    order: order(),
  },
  lost: {
    expect: "REFUND",
    dispute: dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "Tracking says returned to sender. I never got it."),
    order: order("9400100000000000000009"),
  },
  "not-as-described": {
    expect: "REFUND",
    dispute: dispute(
      "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      "The candle arrived cracked in half and the wax had melted. It does not smell like cedar at all.",
    ),
    order: order("9400100000000000000001"),
  },
  unauthorized: {
    expect: "FIGHT",
    dispute: dispute("UNAUTHORISED", "I did not make this purchase."),
    order: order("9400100000000000000004"),
  },
};

const only = process.argv[2];
let pass = 0;
let total = 0;

for (const [key, s] of Object.entries(SCENARIOS)) {
  if (only && key !== only) continue;
  total++;
  const caseFile = buildCaseFile(s.dispute, null, s.order);
  try {
    const { analysis: a, latencyMs } = await analyzeCase(caseFile);
    const ok = a.recommendation === s.expect;
    if (ok) pass++;
    console.log(`\n${ok ? "✅" : "⚠️ "} ${key}  →  ${a.recommendation} (${a.win_probability}%, ${a.confidence})  expected ${s.expect}  [${latencyMs} ms]`);
    console.log(`   type: ${a.dispute_type} | evidence type: ${a.paypal_evidence_type}`);
    console.log(`   ${a.headline}`);
    a.reasoning.forEach((r) => console.log(`   • ${r}`));
    if (a.fraud_signals.length) console.log(`   fraud signals: ${a.fraud_signals.join("; ")}`);
    const text = a.evidence_letter || a.buyer_message;
    console.log(`   ${a.evidence_letter ? "letter" : "buyer msg"} (${text.split(/\s+/).length} words): ${text.slice(0, 160).replace(/\n/g, " ")}…`);
  } catch (err) {
    console.log(`\n❌ ${key}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${pass}/${total} scenarios matched the expected recommendation.`);
