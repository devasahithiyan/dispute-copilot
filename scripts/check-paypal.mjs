// Checks that the PayPal sandbox keys in .env.local work.
// Run with: npm run check:paypal

const id = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
const base = "https://api-m.sandbox.paypal.com";

if (!id || !secret) {
  console.error("✗ PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET missing from .env.local");
  process.exit(1);
}

const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const token = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("✗ PayPal rejected the keys:", token.error_description ?? token);
  process.exit(1);
}
console.log("✓ Sandbox keys work");

const disputesRes = await fetch(`${base}/v1/customer/disputes?page_size=5`, {
  headers: { Authorization: `Bearer ${token.access_token}` },
});
const disputes = await disputesRes.json();
if (!disputesRes.ok) {
  console.error("✗ Disputes API failed:", disputes.message ?? disputes);
  process.exit(1);
}
console.log(`✓ Disputes API works (${disputes.items?.length ?? 0} disputes found)`);
