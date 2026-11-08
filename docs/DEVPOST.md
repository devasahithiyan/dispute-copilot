# Devpost submission text: Dispute Copilot

Copy each section into the matching Devpost field. Replace the bracketed links before submitting.

---

## Project name
Dispute Copilot

## Tagline (one line)
An AI agent that wins PayPal disputes for small sellers, or refunds fast when it can't.

## Inspiration
Every online seller dreads the "I never received my order" email from PayPal. Disputes are rising
(an estimated 261M worldwide in 2025, rising to 324M by 2028), merchants win only about 20–30% of the
ones they fight, and friendly fraud is estimated at around 40% of losses. Big merchants pay
chargeback services 20–30% of what they recover. Small sellers usually don't respond at all,
because building a case means digging through orders, tracking pages and PayPal's evidence rules,
under a deadline. We wanted to give every small seller a dispute analyst that does that work in
seconds.

## What it does
Dispute Copilot connects to a seller's PayPal account and handles disputes end to end:

1. **Detects** new disputes through the PayPal Disputes API.
2. **Builds a case file** from PayPal data: the buyer's reason and own words, the payment, the
   original order, the shipping address, the tracking number and Seller Protection status, plus facts
   checked in code (for example "delivered in the buyer's city" or "dispute opened less than an hour
   after payment").
3. **AI verdict:** a model on Groq classifies the dispute, estimates the chance of winning, and
   recommends **Fight** or **Refund** with reasons, evidence strength and red flags.
4. **Drafts the response:** a PayPal-ready evidence letter citing exact order, transaction and
   tracking IDs, or a polite refund note to the buyer, plus a **PDF evidence packet** with the scan
   history.
5. **One-click action through PayPal:** after the seller reviews and edits, the app submits evidence
   (`provide-evidence` or `provide-supporting-info`, chosen from the dispute's allowed actions) or
   refunds the buyer (`accept-claim`).

A demo storefront with real PayPal Checkout lets anyone create orders and disputes in the sandbox,
including choosing the shipping outcome (delivered, in transit, returned, no tracking) to see how
the agent's advice changes.

## How we built it
- **Next.js 15 + TypeScript** for the dashboard, demo store and API routes.
- **PayPal REST APIs (sandbox):** Orders v2 (create, capture, get, add tracking), Payments v2
  (captures), Customer Disputes v1 (list, get, provide-evidence, provide-supporting-info,
  accept-claim), and the PayPal JS SDK for checkout.
- **Groq** running `openai/gpt-oss-120b` with **strict JSON Schema structured output**, so every
  verdict has the same typed fields. It retries on rate limits and falls back to `gpt-oss-20b`.
- **Grounding and guard rails:** the AI sees only a case file assembled from PayPal records; code then
  clamps scores, removes any tracking number in the letter that isn't on the order, and keeps the
  letter, refund note and evidence type consistent with the recommendation.
- **pdf-lib** generates the evidence packet attached to the PayPal submission.
- A **scenario test harness** (`npm run test:agent`) checks the agent's judgment across five dispute
  types.

## Challenges we ran into
- **Sandbox account regions:** India-registered sandbox sellers and buyers were blocked from
  paying each other, so we moved the whole flow to US sandbox accounts and documented why.
- **Dispute states:** sandbox disputes often jump straight to "under PayPal review," where
  `provide-evidence` isn't allowed. We now read the dispute's HATEOAS links and switch to
  `provide-supporting-info` automatically.
- **Finding the buyer's words:** the buyer's complaint lives in `evidences[].notes`, not `messages`.
- **No real carrier in sandbox:** tracking numbers are fake, so we built a clearly labelled simulated
  carrier whose outcome is controlled from the demo store.
- **Free-tier AI limits:** Groq rate limits led to backoff, retry and model fallback, plus a smaller
  prompt.

## Accomplishments we're proud of
- A complete loop on real PayPal sandbox data: checkout → dispute → AI verdict → evidence or
  refund → dispute resolved in PayPal.
- The agent gives the right call on all five test scenarios, and its letters cite only facts it was
  given.
- It recommends refunds when a case is weak, which saves sellers time and fees instead of
  fighting every case.

## What we learned
- How PayPal disputes move between inquiry, chargeback, seller response and PayPal review, and which
  actions each stage allows.
- Strict structured output plus code-side guard rails makes an LLM reliable enough to take actions
  on money flows, as long as a human approves the final step.

## What's next
- Real carrier tracking (USPS, UPS, FedEx) and PayPal webhooks (`CUSTOMER.DISPUTE.CREATED`) for
  instant detection.
- Multi-seller support with PayPal "Log in with PayPal" onboarding.
- Image evidence (packaging photos) and a learning loop from dispute outcomes to calibrate win
  probabilities.

## Built with
`paypal-orders-api` `paypal-disputes-api` `paypal-js-sdk` `groq` `gpt-oss-120b` `next.js` `typescript`
`tailwindcss` `pdf-lib` `render`

## AI tools used (required field)
- **Groq API, model `openai/gpt-oss-120b`** (fallback `openai/gpt-oss-20b`): the dispute agent. It
  receives a case file built from PayPal data and returns a strict-JSON verdict (type, win
  probability, fight or refund, reasons, evidence, red flags) plus the evidence letter or buyer
  refund note.
- **Claude Code**: used as a coding assistant while building the project.

## Links
- Code: [GitHub repo URL]
- Live demo: [Render URL]
- Video: [YouTube URL]
