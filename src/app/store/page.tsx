import { FlaskConical, Gavel, ShoppingBag, Sparkles } from "lucide-react";
import { PRODUCTS } from "@/lib/catalog";
import { StoreClient } from "./store-client";

export const metadata = { title: "Demo store · Dispute Copilot" };
export const dynamic = "force-dynamic";

export default function StorePage() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const steps = [
    { icon: ShoppingBag, title: "Buy a candle", text: "Pay with your sandbox buyer account. We ship it and save tracking on the PayPal order." },
    { icon: Gavel, title: "Open a dispute", text: "As the buyer, report a problem in PayPal's sandbox Resolution Center." },
    { icon: Sparkles, title: "Watch the copilot", text: "The dispute appears on the dashboard and the AI builds your case." },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 p-6 ring-1 ring-amber-200/60 sm:p-10">
        <div className="pointer-events-none absolute -top-10 -right-10 text-[160px] leading-none opacity-20 select-none sm:text-[220px]">🕯️</div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
          <FlaskConical className="h-3.5 w-3.5" /> Sandbox demo store
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Ember &amp; Wick Candles</h1>
        <p className="mt-2 max-w-xl text-zinc-700">
          A pretend shop with real PayPal Checkout. Use it to create orders and disputes, then see how Dispute Copilot handles them.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl bg-white/70 p-4 ring-1 ring-white backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-semibold text-white">{i + 1}</span>
                <Icon className="h-4 w-4 text-amber-700" />
                <span className="font-medium text-zinc-900">{title}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {clientId ? (
        <StoreClient clientId={clientId} products={PRODUCTS} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          Set <code>NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in <code>.env.local</code> and restart the dev server to enable checkout.
        </div>
      )}
    </div>
  );
}
