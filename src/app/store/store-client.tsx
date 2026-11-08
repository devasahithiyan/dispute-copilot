"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { AlertTriangle, ArrowUpRight, CheckCircle2, PackageCheck, PackageX, Truck, Undo2, X } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { Card, buttonStyles, cn } from "@/components/ui";

interface Purchase {
  orderId: string;
  captureId: string;
  amount: { currency_code: string; value: string };
  trackingNumber: string | null;
  trackingError: string | null;
  productName: string;
  outcome: string;
}

const OUTCOMES = [
  { value: "delivered", label: "Delivered", hint: "Buyer later claims it never came", expect: "Copilot should fight", icon: PackageCheck, tone: "emerald" },
  { value: "in_transit", label: "In transit", hint: "Parcel hasn't arrived yet", expect: "Copilot should refund", icon: Truck, tone: "amber" },
  { value: "returned", label: "Returned", hint: "Lost and sent back to you", expect: "Copilot should refund", icon: Undo2, tone: "rose" },
  { value: "none", label: "No tracking", hint: "Shipped without proof", expect: "Copilot should refund", icon: PackageX, tone: "zinc" },
] as const;

const TONE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  zinc: "bg-zinc-100 text-zinc-600",
};

export function StoreClient({ clientId, products }: { clientId: string; products: Product[] }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string>("delivered");
  // PayPal's button keeps its first callbacks, so read the latest choice from a ref.
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;

  return (
    <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "capture" }}>
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">What happens to the parcel?</h2>
          <p className="text-sm text-zinc-500">Our simulated carrier reports this for your next purchase, so you can test each kind of case.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {OUTCOMES.map((o) => {
            const selected = outcome === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setOutcome(o.value)}
                className={cn(
                  "rounded-2xl border bg-white p-4 text-left transition",
                  selected ? "border-indigo-500 ring-4 ring-indigo-100" : "border-zinc-200 hover:border-zinc-300",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", TONE[o.tone])}>
                    <o.icon className="h-4 w-4" />
                  </span>
                  <span className={cn("h-4 w-4 rounded-full border-2", selected ? "border-indigo-600 bg-indigo-600 ring-2 ring-white ring-inset" : "border-zinc-300")} />
                </div>
                <p className="mt-3 font-medium text-zinc-900">{o.label}</p>
                <p className="text-xs text-zinc-500">{o.hint}</p>
                <p className="mt-2 text-[11px] font-medium text-zinc-400">{o.expect}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="flex flex-col overflow-hidden">
            <div className="flex h-44 items-center justify-center bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 text-7xl">
              {product.emoji}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-zinc-900">{product.name}</h3>
                <span className="font-semibold tabular-nums text-zinc-900">${product.price.toFixed(2)}</span>
              </div>
              <p className="mt-1 mb-5 text-sm text-zinc-500">{product.description}</p>
              <div className="mt-auto">
                <PayPalButtons
                  style={{ layout: "horizontal", label: "buynow", height: 42, tagline: false, shape: "rect" }}
                  fundingSource="paypal"
                  createOrder={async () => {
                    setError(null);
                    const res = await fetch("/api/orders", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ productId: product.id }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Could not create order");
                    return data.id;
                  }}
                  onApprove={async ({ orderID }) => {
                    const chosen = outcomeRef.current;
                    const res = await fetch(`/api/orders/${orderID}/capture`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ outcome: chosen }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setError(data.error ?? "Capture failed");
                      return;
                    }
                    setPurchase({ ...data, productName: product.name, outcome: chosen });
                  }}
                  onError={(err) => setError(err instanceof Error ? err.message : String(err))}
                />
              </div>
            </div>
          </Card>
        ))}
      </section>

      {error && (
        <div className="mt-6 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {purchase && <PurchaseDialog purchase={purchase} onClose={() => setPurchase(null)} />}
    </PayPalScriptProvider>
  );
}

function PurchaseDialog({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const outcome = OUTCOMES.find((o) => o.value === purchase.outcome);
  const rows = [
    ["Order", purchase.orderId],
    ["Transaction", purchase.captureId],
    ["Tracking", purchase.trackingNumber ? `USPS ${purchase.trackingNumber}` : "none"],
    ["Carrier will report", outcome?.label ?? "Delivered"],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-pop sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-zinc-900">
          Paid ${purchase.amount.value} for {purchase.productName}
        </h3>
        <p className="text-sm text-zinc-500">Payment captured through PayPal and the order marked as shipped.</p>

        <dl className="mt-5 space-y-2 rounded-2xl bg-zinc-50 p-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-zinc-500">{k}</dt>
              <dd className="truncate font-mono text-xs text-zinc-800">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <p className="text-sm font-medium text-zinc-900">Next: open a dispute as the buyer</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
            <li>Open the sandbox Resolution Center, logged in as the same buyer.</li>
            <li>Pick this payment → <em>Report a problem</em> → &ldquo;I haven&apos;t received the item&rdquo;.</li>
            <li>The dispute shows on the dashboard in about 1 to 2 minutes.</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <a href="https://www.sandbox.paypal.com/resolutioncenter" target="_blank" rel="noreferrer" className={buttonStyles.primary}>
            Open Resolution Center <ArrowUpRight className="h-4 w-4" />
          </a>
          <Link href="/" className={buttonStyles.secondary}>
            Go to disputes
          </Link>
        </div>
      </div>
    </div>
  );
}
