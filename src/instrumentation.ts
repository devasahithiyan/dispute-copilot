// Runs once when the server starts: fetch the PayPal token up front so the
// first page view doesn't pay the ~3s sandbox sign-in.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getAccessToken, hasPayPalCredentials } = await import("./lib/paypal");
  if (hasPayPalCredentials()) getAccessToken().catch(() => {});
}
