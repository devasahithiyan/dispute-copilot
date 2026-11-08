# 🛡️ Dispute Copilot

**An AI agent that helps small online sellers win PayPal disputes, or refund quickly when they can't win.**

When a buyer opens a dispute ("I never got my order"), small sellers often lose by default: they
don't know what proof PayPal wants, and gathering it takes hours. Merchants win only about
20–30% of the disputes they fight.

Dispute Copilot does the work for them:

1. **Detects** new disputes through the PayPal Disputes API.
2. **Builds a case file** from PayPal: the dispute, the buyer's own words, the payment, the original
   order, the shipping address, the tracking number and Seller Protection status.
3. **Asks an AI model** (Groq, `openai/gpt-oss-120b`) to classify the dispute, estimate the chance of
   winning, decide **fight or refund**, and draft either an evidence letter to PayPal or an apology
   to the buyer.
4. **Generates a PDF evidence packet** (order, payment, carrier scan history, letter).
5. **Acts through PayPal** once the seller clicks approve: it submits the evidence and PDF, or
   accepts the claim and refunds the buyer.

> Built for the PayPal AI Hackathon. Runs entirely on the **PayPal sandbox**. No real money moves.

![flow](https://img.shields.io/badge/flow-dispute%20→%20case%20file%20→%20AI%20verdict%20→%20one--click%20action-6d28d9)

## What it looks like

| Screen | What you see |
|---|---|
| **Disputes** (`/`) | Live list from PayPal, money at risk, and the Copilot's call per dispute ("Fight · 82%", "Refund · 10%", "✓ Evidence sent") |
| **Dispute detail** (`/disputes/:id`) | The agent runs on open: a verdict, win-chance meter, reasons, evidence strength, red flags, an editable letter, a PDF preview, and **Approve & submit** / **Approve refund** buttons. Below that is the full case file the AI saw. |
| **Demo store** (`/store`) | A pretend candle shop with real PayPal Checkout, used to create test orders and disputes. Pick a shipping outcome (delivered, in transit, returned, no tracking) to steer the scenario. |

## How PayPal and AI are used

### PayPal (sandbox)

| API | Used for |
|---|---|
| **Orders v2**: create, capture, get | Demo store checkout; reading the original order behind a dispute |
| **Orders v2 tracking** `POST /v2/checkout/orders/{id}/track` | Attaching the USPS tracking number when an order "ships" |
| **Payments v2** `GET /v2/payments/captures/{id}` | Linking a dispute's transaction back to its order |
| **Customer Disputes v1**: list, get | Detecting disputes and reading the reason, buyer notes, Seller Protection and allowed actions |
| **Disputes v1** `provide-evidence` | Submitting the letter, tracking info and PDF while PayPal waits for the seller |
| **Disputes v1** `provide-supporting-info` | Sending the letter and PDF when the case is already under PayPal review |
| **Disputes v1** `accept-claim` | One-click refund when the agent advises against fighting |
| **PayPal JS SDK** (`@paypal/react-paypal-js`) | Checkout buttons in the demo store |

The app reads the dispute's HATEOAS links to choose between `provide-evidence` and
`provide-supporting-info` automatically.

### AI (Groq)

- **Model:** `openai/gpt-oss-120b` on Groq, with automatic fallback to `openai/gpt-oss-20b` if the
  free-tier rate limit is hit.
- **Structured output:** strict JSON Schema (`response_format: json_schema`), so the answer always
  has the same fields: dispute type, headline, summary, win probability, FIGHT/REFUND, confidence,
  reasons, evidence with strength, missing evidence, red flags, PayPal evidence type, letter and
  buyer message.
- **Grounding:** the model only sees a case file built in code from PayPal data
  ([`case-file.ts`](src/lib/agent/case-file.ts)), plus facts checked in code first, such as "delivery
  city matches the order address" or "dispute opened less than an hour after payment".
- **Guard rails** ([`analyze.ts`](src/lib/agent/analyze.ts)): the win chance is clamped to 0–100, any
  tracking number in the letter that isn't on the order is removed, and the letter, buyer message and
  evidence type are kept consistent with the recommendation.
- **Human in the loop:** nothing is sent to PayPal until the seller reviews, optionally edits, and
  clicks approve.

### Accuracy check

`npm run test:agent` runs the agent on five scenarios. Current results:

| Scenario | Agent says | Win chance |
|---|---|---|
| Delivered to buyer's address, buyer says "never arrived" | FIGHT | ~85% |
| No tracking number | REFUND | ~10% |
| Parcel returned to sender | REFUND | ~10% |
| "Arrived cracked, doesn't smell right" (not as described) | REFUND | ~30% |
| "I didn't make this purchase", delivered to account address | FIGHT | ~60–85% |

## Architecture

```
Browser (Next.js pages)
  ├─ /store ──► PayPal JS SDK checkout ──► /api/orders (create) ──► /api/orders/:id/capture (capture + track)
  └─ /disputes/:id
        ├─ /api/disputes/:id/analyze ──► loadCase(): Disputes + Payments + Orders APIs
        │                                   └─► buildCaseFile()  (facts + carrier scans + signals)
        │                                         └─► Groq gpt-oss-120b (strict JSON schema) ──► guard rails ──► data/disputes.json
        ├─ /api/disputes/:id/submit-evidence ──► PDF packet ──► provide-evidence | provide-supporting-info
        ├─ /api/disputes/:id/refund ──► accept-claim
        └─ /api/disputes/:id/evidence-pdf (preview)
```

Key files: [`src/lib/paypal.ts`](src/lib/paypal.ts) (PayPal client),
[`src/lib/agent/`](src/lib/agent) (case file, carrier, AI, PDF),
[`src/app/disputes/[id]/agent-panel.tsx`](src/app/disputes/[id]/agent-panel.tsx) (agent UI).

### About the carrier data

Sandbox tracking numbers aren't real, so no carrier can say where a test parcel went.
[`carrier.ts`](src/lib/agent/carrier.ts) simulates the carrier: the tracking number's last digit
decides the outcome (0–6 delivered, 7–8 in transit, 9 returned), and scan times are compressed to
minutes. The UI labels this as simulated. In production this module would call USPS, UPS or FedEx, or
a tracking aggregator.

## Run it yourself

### 1. PayPal sandbox (about 10 minutes)

1. Sign in at [developer.paypal.com](https://developer.paypal.com) → **Testing Tools → Sandbox
   Accounts**. Create one **Business** account (the seller) and one **Personal** account (the buyer),
   **both with country United States**. India sandbox accounts are blocked from these payments
   ("seller doesn't accept payments in your currency" / "declined to comply with international
   regulations").
2. **Apps & Credentials** (Sandbox) → **Create App**, type Merchant, linked to the US Business
   account. Copy the **Client ID** and **Secret**.
3. Note the Personal account's email and password (**View/Edit account**). You'll pay with it.

### 2. Groq key

Create a free key at [console.groq.com/keys](https://console.groq.com/keys).

### 3. Install and start

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # fill in the four values
npm run check:paypal         # ✓ Sandbox keys work / ✓ Disputes API works
npm run dev
```

Open http://localhost:3000.

For the fastest experience (for example when recording a demo), run the production build instead:

```bash
npm run build && npm start
```

PayPal's sandbox takes about 1 second per API call, so the app caches PayPal reads in memory, loads
the payment and order in parallel, streams pages behind skeleton loaders, signs in to PayPal when the
server starts, and preloads open disputes from the dashboard. Repeat visits load in about 0.1 s.

### 4. Create a dispute and let the agent handle it

1. **Demo store** → leave the outcome on "Delivered to buyer" → **Buy Now** → pay with the sandbox
   buyer. The payment is captured and a tracking number attached.
2. Log in to [sandbox.paypal.com](https://www.sandbox.paypal.com) as the buyer → **Resolution
   Center** → pick the payment → **Report a problem** → "I haven't received the item" → submit.
3. Wait about 1–2 minutes for the sandbox to list it, then refresh **Disputes** and open it. The agent
   runs automatically and should recommend **Fight**. Review the letter and click **Approve & submit
   to PayPal**.
4. Repeat with "Still in transit" or "Returned to sender" to see the agent recommend a refund. Click
   **Approve refund** and the case resolves in PayPal.

Optional: `npm run test:agent` runs the AI on the five built-in scenarios without touching PayPal.

## Environment variables

| Name | What it is |
|---|---|
| `PAYPAL_CLIENT_ID` | Sandbox app Client ID |
| `PAYPAL_CLIENT_SECRET` | Sandbox app Secret |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Same Client ID, used by the checkout button in the browser |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | Optional, default `openai/gpt-oss-120b` |

## Deploy (Render)

[`render.yaml`](render.yaml) defines a Node web service: `npm ci && npm run build`, then
`npm start`. Create a Blueprint from the repo and fill in the five environment variables. AI
analyses are cached in `data/disputes.json`, which resets when the service restarts. That's fine for
a demo, because the agent re-runs on demand.

## Limitations and next steps

- Carrier scans are simulated in the sandbox; real carrier APIs are the next integration.
- Single seller and file-based storage; production would use a database and PayPal webhooks
  (`CUSTOMER.DISPUTE.CREATED`) instead of polling.
- Evidence is text and PDF; photos of packaging or signed delivery receipts would further strengthen
  "not as described" cases.

## Tech

Next.js 15 (App Router, TypeScript), Tailwind CSS 4, PayPal REST APIs and JS SDK, Groq
(`openai/gpt-oss-120b`), pdf-lib.

## License

[MIT](./LICENSE)
