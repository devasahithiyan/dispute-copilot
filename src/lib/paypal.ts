import "server-only";
import type {
  Capture,
  Dispute,
  DisputeList,
  Order,
} from "./paypal-types";
import type { Product } from "./catalog";
import { getOrderIdForCapture, saveOrderLink } from "./store";

// This project only ever talks to the PayPal sandbox.
const BASE_URL = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public debugId?: string,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

/**
 * fetch with a few quick retries for network blips (DNS hiccups, resets)
 * and PayPal 5xx responses. Other errors are returned to the caller as-is.
 */
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || i >= attempts) return res;
    } catch (err) {
      if (i >= attempts) {
        throw new PayPalError(
          `Could not reach PayPal (${err instanceof Error ? (err.cause as Error)?.message ?? err.message : err}). Check your internet connection and refresh.`,
          503,
        );
      }
    }
    await new Promise((r) => setTimeout(r, 400 * i));
  }
}

export function hasPayPalCredentials(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

// Module state lives on globalThis so dev hot reloads don't throw it away.
const g = globalThis as typeof globalThis & {
  __ppToken?: { value: string; expiresAt: number };
  __ppTokenPending?: Promise<string>;
  __ppCache?: Map<string, { expiresAt: number; value: Promise<unknown> }>;
};
const cache = (g.__ppCache ??= new Map());

/** Fetches an OAuth token once and shares it; concurrent callers wait on one request. */
export function getAccessToken(): Promise<string> {
  if (g.__ppToken && Date.now() < g.__ppToken.expiresAt) return Promise.resolve(g.__ppToken.value);
  g.__ppTokenPending ??= fetchToken().finally(() => (g.__ppTokenPending = undefined));
  return g.__ppTokenPending;
}

async function fetchToken(): Promise<string> {

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PayPalError("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set", 500);
  }

  const res = await fetchWithRetry(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new PayPalError(
      `PayPal auth failed: ${data.error_description ?? res.statusText}`,
      res.status,
      data,
    );
  }

  // Refresh a minute early so a token never expires mid-request.
  g.__ppToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return g.__ppToken.value;
}

/** Drops cached reads for one dispute (and the list) after we change it. */
export function invalidateDispute(disputeId?: string) {
  for (const key of cache.keys()) {
    if (key.startsWith("/v1/customer/disputes?") || (disputeId && key.includes(disputeId))) cache.delete(key);
  }
}

/**
 * GET requests with `ttlMs` are cached in memory and shared between
 * concurrent callers. The PayPal sandbox takes ~1s per request, so this is
 * what keeps pages fast after the first visit.
 */
function paypal<T>(
  path: string,
  options: { method?: string; body?: unknown; ttlMs?: number } = {},
): Promise<T> {
  if ((options.method ?? "GET") !== "GET" || !options.ttlMs) return request<T>(path, options);
  const hit = cache.get(path);
  if (hit && Date.now() < hit.expiresAt) return hit.value as Promise<T>;
  const value = request<T>(path, options);
  cache.set(path, { expiresAt: Date.now() + options.ttlMs, value });
  value.catch(() => cache.delete(path));
  return value;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getAccessToken();
  const method = options.method ?? "GET";
  // Only reads are retried; repeating a capture, refund or submission could
  // apply it twice.
  const res = await fetchWithRetry(
    `${BASE_URL}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    },
    method === "GET" ? 3 : 1,
  );

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new PayPalError(
      data.message ?? data.error_description ?? `PayPal request failed: ${path}`,
      res.status,
      data.details ?? data,
      data.debug_id ?? res.headers.get("paypal-debug-id") ?? undefined,
    );
  }
  return data as T;
}

/* ---------- Orders (demo store checkout) ---------- */

export function createOrder(product: Product) {
  const value = product.price.toFixed(2);
  return paypal<Order>("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: product.id,
          custom_id: product.id,
          description: product.name,
          amount: {
            currency_code: "USD",
            value,
            breakdown: { item_total: { currency_code: "USD", value } },
          },
          items: [
            {
              name: product.name,
              description: product.description,
              sku: product.id,
              quantity: "1",
              unit_amount: { currency_code: "USD", value },
              category: "PHYSICAL_GOODS",
            },
          ],
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Ember & Wick Candles",
            shipping_preference: "GET_FROM_FILE",
            user_action: "PAY_NOW",
          },
        },
      },
    },
  });
}

export function captureOrder(orderId: string) {
  return paypal<Order>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: {},
  });
}

export function getOrder(orderId: string) {
  return paypal<Order>(`/v2/checkout/orders/${orderId}`, { ttlMs: 5 * 60_000 });
}

/** Attaches a shipment tracking number to a captured order. */
export function addTracking(
  orderId: string,
  captureId: string,
  trackingNumber: string,
  carrier = "USPS",
) {
  return paypal<Order>(`/v2/checkout/orders/${orderId}/track`, {
    method: "POST",
    body: {
      capture_id: captureId,
      tracking_number: trackingNumber,
      carrier,
      notify_payer: false,
    },
  });
}

/* ---------- Payments ---------- */

export function getCapture(captureId: string) {
  return paypal<Capture>(`/v2/payments/captures/${captureId}`, { ttlMs: 10 * 60_000 });
}

/* ---------- Disputes ---------- */

export function listDisputes() {
  return paypal<DisputeList>("/v1/customer/disputes?page_size=50", { ttlMs: 20_000 });
}

export function getDispute(disputeId: string) {
  return paypal<Dispute>(`/v1/customer/disputes/${disputeId}`, { ttlMs: 20_000 });
}

/**
 * Submits the seller's evidence. PayPal expects multipart/form-data with a
 * JSON part named "input" plus optional document files (PDF/JPG/PNG).
 * Only allowed while the dispute is WAITING_FOR_SELLER_RESPONSE.
 */
export async function provideEvidence(
  disputeId: string,
  evidence: {
    evidenceType: string;
    notes: string;
    tracking?: { carrier: string; number: string }[];
    document?: { name: string; bytes: Uint8Array };
  },
) {
  const input = {
    evidences: [
      {
        evidence_type: evidence.evidenceType,
        evidence_info: evidence.tracking?.length
          ? {
              tracking_info: evidence.tracking.map((t) => ({
                carrier_name: t.carrier,
                tracking_number: t.number,
              })),
            }
          : undefined,
        notes: evidence.notes.slice(0, 2000),
      },
    ],
  };

  const form = new FormData();
  form.append("input", new Blob([JSON.stringify(input)], { type: "application/json" }));
  if (evidence.document) {
    form.append(
      "file1",
      new Blob([evidence.document.bytes as BlobPart], { type: "application/pdf" }),
      evidence.document.name,
    );
  }

  const token = await getAccessToken();
  const res = await fetchWithRetry(`${BASE_URL}/v1/customer/disputes/${disputeId}/provide-evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    cache: "no-store",
  }, 1);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new PayPalError(
      data.message ?? "PayPal rejected the evidence",
      res.status,
      data.details ?? data,
      data.debug_id,
    );
  }
  return data;
}

/**
 * Adds the seller's notes and documents to a dispute that PayPal is already
 * reviewing (status UNDER_REVIEW). Same multipart format as provide-evidence.
 */
export async function provideSupportingInfo(
  disputeId: string,
  info: { notes: string; document?: { name: string; bytes: Uint8Array } },
) {
  const form = new FormData();
  form.append(
    "input",
    new Blob([JSON.stringify({ notes: info.notes.slice(0, 2000) })], { type: "application/json" }),
  );
  if (info.document) {
    form.append(
      "file1",
      new Blob([info.document.bytes as BlobPart], { type: "application/pdf" }),
      info.document.name,
    );
  }

  const token = await getAccessToken();
  const res = await fetchWithRetry(
    `${BASE_URL}/v1/customer/disputes/${disputeId}/provide-supporting-info`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, cache: "no-store" },
    1,
  );
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new PayPalError(
      data.message ?? "PayPal rejected the supporting information",
      res.status,
      data.details ?? data,
      data.debug_id,
    );
  }
  return data;
}

/**
 * Which way PayPal will currently accept the seller's case, read from the
 * HATEOAS links on the dispute.
 */
export function submissionMode(dispute: Dispute): "evidence" | "supporting-info" | null {
  const actions = (dispute.links ?? []).map((l) => l.href.split("/").pop());
  if (actions.includes("provide-evidence") || dispute.status === "WAITING_FOR_SELLER_RESPONSE") return "evidence";
  if (actions.includes("provide-supporting-info")) return "supporting-info";
  return null;
}

/** Accepts the buyer's claim, which refunds them the disputed amount. */
export function acceptClaim(disputeId: string, note: string) {
  return paypal(`/v1/customer/disputes/${disputeId}/accept-claim`, {
    method: "POST",
    body: { note: note.slice(0, 2000), accept_claim_type: "REFUND" },
  });
}

/**
 * Sandbox-only helper: PayPal's sandbox often sends new disputes straight to
 * "under PayPal review". This moves the dispute back to
 * WAITING_FOR_SELLER_RESPONSE so the evidence flow can be demonstrated.
 */
export function sandboxRequestSellerEvidence(disputeId: string) {
  return paypal(`/v1/customer/disputes/${disputeId}/require-evidence`, {
    method: "POST",
    body: { action: "SELLER_EVIDENCE" },
  });
}

/**
 * Everything the agent needs to judge a dispute: the dispute itself, the
 * payment it is about, and the original order (items, shipping, tracking).
 * The order and capture are optional: older or external payments may not
 * link back to an order we can read.
 */
export async function getDisputeContext(disputeId: string) {
  const dispute = await getDispute(disputeId);
  const captureId = dispute.disputed_transactions?.[0]?.seller_transaction_id;
  if (!captureId) return { dispute, capture: null, order: null };

  // Orders bought through our store were saved at checkout, so the capture
  // and order can load in parallel. Otherwise follow the capture's "up" link.
  const knownOrderId = await getOrderIdForCapture(captureId);
  if (knownOrderId) {
    const [capture, order] = await Promise.all([
      getCapture(captureId).catch(() => null),
      getOrder(knownOrderId).catch(() => null),
    ]);
    return { dispute, capture, order };
  }

  const capture = await getCapture(captureId).catch(() => null);
  const orderId = capture?.links?.find((l) => l.rel === "up")?.href.split("/").pop();
  const order = orderId ? await getOrder(orderId).catch(() => null) : null;
  if (orderId) await saveOrderLink(captureId, orderId);
  return { dispute, capture, order };
}
