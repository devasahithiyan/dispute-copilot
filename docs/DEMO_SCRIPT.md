# Demo video script (target 2:30, hard limit 3:00)

**Before recording**
- `npm run dev`, browser at 1280px wide, zoom 110%.
- Prepare one fresh dispute that is **delivered** (agent says Fight) and leave it unopened, so
  the agent runs live on camera. Prepare one **in transit** dispute that has already been analyzed
  (agent says Refund).
- Be logged in to sandbox.paypal.com as the buyer in a second tab.
- No background music, or only royalty-free music (Devpost rule).

| Time | Screen | Say |
|---|---|---|
| 0:00–0:15 | Title card or dashboard | "Online sellers lose most PayPal disputes, often without responding, because building a case takes hours. Dispute Copilot is an AI agent that builds the case for them." |
| 0:15–0:40 | `/store`: pick "Delivered to buyer", Buy Now, pay with PayPal | "Here's a small candle shop using PayPal Checkout. The order is paid and shipped, and the tracking number is saved on the PayPal order." |
| 0:40–0:55 | sandbox.paypal.com → Resolution Center → filed case | "Now the buyer claims it never arrived and opens a PayPal dispute." *(Show the already-filed case; cut the waiting.)* |
| 0:55–1:10 | Dashboard | "The dispute shows up from PayPal's Disputes API, with the money at risk." Click it. |
| 1:10–1:45 | Dispute page, agent progress then verdict | "The agent reads the dispute, pulls the order, payment and tracking from PayPal, and asks Groq's gpt-oss model for a verdict. Delivered to the buyer's own address, Seller Protection, and the buyer never contacted us, so: fight it, 82%." Scroll the reasons and red flags. |
| 1:45–2:05 | Letter + "Preview PDF evidence packet" | "It writes the evidence letter with the exact order and tracking IDs, and builds this PDF packet. I can edit anything." |
| 2:05–2:20 | Click Approve & submit → "✓ Evidence sent" | "One click and it goes to PayPal through the Disputes API." |
| 2:20–2:40 | Open the in-transit dispute → Refund verdict → Approve refund → dashboard shows Resolved | "When the evidence is weak, the parcel is still in transit, so it recommends a refund instead and refunds the buyer through PayPal in one click." |
| 2:40–2:55 | Dashboard | "Dispute Copilot: PayPal APIs for the data and the actions, AI for the judgment, and the seller stays in control." |

**Recording tips:** use QuickTime (File → New Screen Recording) or OBS. Trim waits in iMovie.
Upload to YouTube as **Public** and paste the link into Devpost.
