// The AI step: send the case file to a Groq-hosted model and get back a
// structured verdict plus a ready-to-submit evidence letter.

import type { CaseFile } from "./case-file";

export const DISPUTE_TYPES = [
  "ITEM_NOT_RECEIVED",
  "NOT_AS_DESCRIBED",
  "UNAUTHORIZED",
  "BILLING_ISSUE",
  "OTHER",
] as const;

// PayPal evidence_type values the agent may pick for a submission.
export const PAYPAL_EVIDENCE_TYPES = [
  "PROOF_OF_FULFILLMENT",
  "PROOF_OF_REFUND",
  "PROOF_OF_DELIVERY_SIGNATURE",
  "PROOF_OF_RECEIPT_COPY",
  "OTHER",
] as const;

export interface Analysis {
  dispute_type: (typeof DISPUTE_TYPES)[number];
  headline: string;
  summary: string;
  win_probability: number;
  recommendation: "FIGHT" | "REFUND";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reasoning: string[];
  evidence: { label: string; detail: string; strength: "STRONG" | "MODERATE" | "WEAK" }[];
  missing_evidence: string[];
  fraud_signals: string[];
  paypal_evidence_type: (typeof PAYPAL_EVIDENCE_TYPES)[number];
  evidence_letter: string;
  buyer_message: string;
}

export interface AnalysisResult {
  analysis: Analysis;
  model: string;
  createdAt: string;
  latencyMs: number;
  disputeUpdatedAt?: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "dispute_type",
    "headline",
    "summary",
    "win_probability",
    "recommendation",
    "confidence",
    "reasoning",
    "evidence",
    "missing_evidence",
    "fraud_signals",
    "paypal_evidence_type",
    "evidence_letter",
    "buyer_message",
  ],
  properties: {
    dispute_type: { type: "string", enum: DISPUTE_TYPES },
    headline: { type: "string", description: "One short sentence verdict for the seller." },
    summary: { type: "string", description: "2-3 plain sentences: what the buyer claims and what the records show." },
    win_probability: { type: "integer", description: "0-100 estimated chance the seller wins if they fight." },
    recommendation: { type: "string", enum: ["FIGHT", "REFUND"] },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    reasoning: { type: "array", items: { type: "string" }, description: "3-5 short bullet points." },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail", "strength"],
        properties: {
          label: { type: "string" },
          detail: { type: "string" },
          strength: { type: "string", enum: ["STRONG", "MODERATE", "WEAK"] },
        },
      },
    },
    missing_evidence: { type: "array", items: { type: "string" } },
    fraud_signals: { type: "array", items: { type: "string" } },
    paypal_evidence_type: { type: "string", enum: PAYPAL_EVIDENCE_TYPES },
    evidence_letter: {
      type: "string",
      description: "If FIGHT: the seller's response to PayPal. If REFUND: empty string.",
    },
    buyer_message: {
      type: "string",
      description: "If REFUND: a short, polite note to the buyer. If FIGHT: empty string.",
    },
  },
} as const;

const SYSTEM_PROMPT = `You are Dispute Copilot, an analyst who helps small online sellers respond to PayPal disputes.

You receive a CASE FILE in JSON. It is the only source of truth.
Rules:
- Use only facts in the case file. Never invent tracking numbers, dates, addresses, photos, signatures, conversations or policies.
- Quote identifiers (order id, transaction id, tracking number) exactly as written.
- Carrier scans marked "simulated": true come from a sandbox demo carrier. Treat them as the carrier record, but do not call them simulated in the letter.
- Recommend FIGHT only when the records directly contradict the buyer's claim (for example: delivered to the buyer's own address). Recommend REFUND when the records support the buyer (no tracking, parcel lost, returned, still in transit long after the promised date) or evidence is too thin; fighting a losing case wastes the seller's time and fees.
- Win probability guide for "item not received": delivered scan to the order address with Seller Protection ~75-90; delivered but address mismatch ~35-50; in transit ~15-30; no tracking or returned to sender ~5-15. Adjust for other signals. For "unauthorized" claims, delivery to the account holder's own address helps but is weaker (~55-70), because the account owner may still claim someone else used their login. For "not as described", tracking does not help much.
- Fraud signals: list only concrete red flags suggesting the buyer's claim may be untrue, such as "delivered to the buyer's address but claimed missing" or "dispute opened within hours of payment". Not contacting the seller first counts only when the records also contradict the buyer. A missing tracking number is a weakness of the seller's case, not a fraud signal. Return an empty list when the records support the buyer. Never accuse the buyer in the letter; state facts neutrally.
- Evidence letter (when FIGHT): addressed to "PayPal Resolution Team", professional, 120-220 words, structured as: summary of the order, shipment and delivery facts with dates, a direct answer to the buyer's claim, a list of attached records, and a request to close the case in the seller's favour. The only attachment is one PDF evidence packet containing the order details, payment record, shipping address, carrier scan history and this letter; never mention screenshots, photos, receipts or any other attachment. Sign as "The Ember & Wick Candles team".
- Buyer message (when REFUND): 40-80 words, warm and apologetic, confirms the full refund.
- Keep every bullet under 25 words. Write plain English for a busy small-business owner.`;

const FALLBACK_MODEL = "openai/gpt-oss-20b";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function analyzeCase(caseFile: CaseFile): Promise<AnalysisResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  const primary = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const started = Date.now();

  // Free-tier Groq keys are rate limited per minute. Wait and retry on 429,
  // then fall back to the smaller model rather than failing the seller.
  const attempts = [primary, primary, FALLBACK_MODEL, FALLBACK_MODEL];
  let lastError = "";
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    const res = await callGroq(apiKey, model, caseFile);
    if (res.ok) {
      return {
        analysis: sanitize(JSON.parse(res.content), caseFile),
        model,
        createdAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    }
    lastError = res.error;
    if (res.status !== 429 && res.status < 500) break;
    const waitS = Number(res.error.match(/try again in ([\d.]+)s/)?.[1] ?? 5);
    if (i < attempts.length - 1 && attempts[i + 1] === model) await sleep(Math.min(waitS, 20) * 1000 + 250);
  }
  throw new Error(lastError);
}

async function callGroq(
  apiKey: string,
  model: string,
  caseFile: CaseFile,
): Promise<{ ok: true; content: string } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      reasoning_effort: "low",
      max_completion_tokens: 2500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `CASE FILE:\n${JSON.stringify(caseFile)}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "dispute_analysis", strict: true, schema: SCHEMA },
      },
    }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Groq request failed (${res.status}): ${data?.error?.message ?? res.statusText}` };
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { ok: false, status: 502, error: "Groq returned an empty response" };
  return { ok: true, content };
}

/** Guard rails applied after the model answers. */
function sanitize(a: Analysis, c: CaseFile): Analysis {
  a.win_probability = Math.max(0, Math.min(100, Math.round(Number(a.win_probability) || 0)));

  // Never let the letter cite a tracking number that is not on the order.
  const known = new Set(c.tracking.map((t) => t.trackingNumber));
  for (const n of a.evidence_letter.match(/\b9\d{15,25}\b/g) ?? []) {
    if (!known.has(n)) {
      a.evidence_letter = a.evidence_letter.replaceAll(n, "[tracking number on file]");
      a.reasoning.push("Removed a tracking number from the draft that was not on the order.");
    }
  }

  // Keep the two outputs consistent with the recommendation.
  if (a.recommendation === "REFUND") a.evidence_letter = "";
  if (a.recommendation === "FIGHT") a.buyer_message = "";
  if (a.recommendation === "FIGHT" && a.paypal_evidence_type === "PROOF_OF_REFUND") {
    a.paypal_evidence_type = "PROOF_OF_FULFILLMENT";
  }
  if (a.recommendation === "REFUND") a.paypal_evidence_type = "PROOF_OF_REFUND";
  return a;
}
