import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Gavel,
  MapPin,
  MessageSquareQuote,
  Package,
  PackageCheck,
  ScanSearch,
  ShieldCheck,
  Truck,
  Undo2,
} from "lucide-react";
import { hasPayPalCredentials, submissionMode } from "@/lib/paypal";
import { loadCase } from "@/lib/dispute-service";
import { getRecord, type ActionRecord } from "@/lib/store";
import type { CaseFile } from "@/lib/agent/case-file";
import { ago, humanize, money, reasonLabel, shortDate } from "@/lib/format";
import { Avatar, Badge, Card, ProductTile, SectionTitle, StatusBadge, cn } from "@/components/ui";
import { SetupNotice } from "../../setup-notice";
import { AgentPanel } from "./agent-panel";

export const dynamic = "force-dynamic";

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasPayPalCredentials()) return <SetupNotice />;

  let data;
  try {
    data = await loadCase(id);
  } catch (err) {
    return <SetupNotice message={err instanceof Error ? err.message : String(err)} />;
  }
  const { dispute, caseFile } = data;
  const record = await getRecord(id);
  const itemName = caseFile.order?.items[0]?.name ?? dispute.disputed_transactions?.[0]?.items?.[0]?.item_name;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> All disputes
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <ProductTile itemName={itemName} className="h-14 w-14 text-3xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{itemName ?? reasonLabel(dispute.reason)}</h1>
              <Badge>{reasonLabel(dispute.reason)}</Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {caseFile.buyer.name ?? "Buyer"} opened this {ago(dispute.create_time)} ·{" "}
              <span className="font-mono text-xs">{dispute.dispute_id}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-900">{money(dispute.dispute_amount)}</span>
          <StatusBadge status={dispute.status} />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AgentPanel
          disputeId={id}
          status={dispute.status}
          amountLabel={money(dispute.dispute_amount)}
          buyerName={caseFile.buyer.name}
          submitMode={submissionMode(dispute)}
          initial={record.analysis ?? null}
          actions={record.actions ?? []}
        />

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Timeline caseFile={caseFile} actions={record.actions ?? []} />
          <BuyerClaim caseFile={caseFile} />
          <OrderCard caseFile={caseFile} />
          {caseFile.signals.length > 0 && (
            <Card className="space-y-3 p-5">
              <SectionTitle icon={<ScanSearch className="h-3.5 w-3.5" />}>Checked in code</SectionTitle>
              <ul className="space-y-2 text-sm text-zinc-600">
                {caseFile.signals.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

interface Step {
  at?: string;
  title: string;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "zinc" | "green" | "amber" | "red" | "indigo";
}

function Timeline({ caseFile, actions }: { caseFile: CaseFile; actions: ActionRecord[] }) {
  const steps: Step[] = [];
  if (caseFile.payment.paidAt) {
    steps.push({ at: caseFile.payment.paidAt, title: `Paid ${money(caseFile.payment.amount)}`, detail: "via PayPal Checkout", icon: CreditCard, tone: "zinc" });
  }
  for (const t of caseFile.tracking) {
    steps.push({ at: t.events[0]?.time, title: `Shipped with ${t.carrier}`, detail: t.trackingNumber, icon: Truck, tone: "zinc" });
    const last = t.events.at(-1);
    if (t.status === "DELIVERED") steps.push({ at: t.deliveredAt, title: "Delivered", detail: `${last?.description.replace("Delivered, ", "")} · ${t.deliveredTo}`, icon: PackageCheck, tone: "green" });
    if (t.status === "IN_TRANSIT") steps.push({ at: last?.time, title: "Still in transit", detail: last?.location, icon: Truck, tone: "amber" });
    if (t.status === "EXCEPTION") steps.push({ at: last?.time, title: "Returned to sender", detail: "Delivery exception", icon: Undo2, tone: "red" });
  }
  if (caseFile.tracking.length === 0) steps.push({ title: "No tracking on file", detail: "Shipment can't be proven", icon: Package, tone: "red" });
  steps.push({ at: caseFile.openedAt, title: "Buyer opened dispute", detail: reasonLabel(caseFile.reason), icon: Gavel, tone: "red" });
  for (const a of actions) {
    steps.push({ at: a.at, title: a.type === "EVIDENCE_SUBMITTED" ? "Evidence sent to PayPal" : "Buyer refunded", detail: "by Dispute Copilot", icon: BadgeCheck, tone: "indigo" });
  }
  steps.sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : 0));

  const dot = {
    zinc: "bg-zinc-100 text-zinc-500",
    green: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-rose-100 text-rose-600",
    indigo: "bg-indigo-100 text-indigo-600",
  };

  return (
    <Card className="space-y-4 p-5">
      <SectionTitle icon={<CalendarClock className="h-3.5 w-3.5" />}>Timeline</SectionTitle>
      <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-zinc-200">
        {steps.map((s, i) => (
          <li key={i} className="relative flex gap-3">
            <span className={cn("z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white", dot[s.tone])}>
              <s.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-zinc-900">{s.title}</p>
              <p className="truncate text-xs text-zinc-500">
                {s.detail}
                {s.at && <> · {shortDate(s.at)}</>}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {caseFile.tracking.length > 0 && (
        <details className="group rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <summary className="cursor-pointer font-medium text-zinc-700">Full carrier scan history</summary>
          <ol className="mt-2 space-y-1.5">
            {[...caseFile.tracking[0].events].reverse().map((e, i) => (
              <li key={i}>
                <span className="font-medium text-zinc-800">{e.description}</span> · {e.location} · {shortDate(e.time)}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-zinc-400">Carrier scans are simulated for the sandbox demo.</p>
        </details>
      )}
    </Card>
  );
}

function BuyerClaim({ caseFile }: { caseFile: CaseFile }) {
  return (
    <Card className="space-y-3 p-5">
      <SectionTitle icon={<MessageSquareQuote className="h-3.5 w-3.5" />}>Buyer&apos;s claim</SectionTitle>
      <div className="flex items-center gap-3">
        <Avatar name={caseFile.buyer.name} className="h-9 w-9 text-xs" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900">{caseFile.buyer.name ?? "Buyer"}</p>
          <p className="truncate text-xs text-zinc-500">{caseFile.buyer.email}</p>
        </div>
      </div>
      {caseFile.buyerClaims.length ? (
        caseFile.buyerClaims.map((c, i) => (
          <blockquote key={i} className="rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-700">
            &ldquo;{c.text}&rdquo;
          </blockquote>
        ))
      ) : (
        <p className="text-sm text-zinc-500">No written message, only a reason code.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {caseFile.buyerRequestedRefund && <Badge>Wants {money(caseFile.buyerRequestedRefund)}</Badge>}
        <Badge tone={caseFile.buyerContactedSellerFirst ? "neutral" : "amber"}>
          {caseFile.buyerContactedSellerFirst ? "Contacted you first" : "Didn't contact you first"}
        </Badge>
      </div>
    </Card>
  );
}

function OrderCard({ caseFile }: { caseFile: CaseFile }) {
  const rows: [string, React.ReactNode][] = [
    ["Order", <span key="o" className="font-mono text-xs">{caseFile.order?.id ?? "—"}</span>],
    ["Transaction", <span key="t" className="font-mono text-xs">{caseFile.payment.transactionId ?? "—"}</span>],
    ...(caseFile.order?.items ?? []).map((it, i): [string, React.ReactNode] => [i === 0 ? "Items" : "", `${it.quantity} × ${it.name}`]),
    ["Paid", shortDate(caseFile.payment.paidAt)],
  ];
  return (
    <Card className="space-y-3 p-5">
      <SectionTitle icon={<Package className="h-3.5 w-3.5" />}>Order & payment</SectionTitle>
      <dl className="space-y-2 text-sm">
        {rows.map(([k, v], i) => (
          <div key={i} className="flex justify-between gap-3">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="text-right text-zinc-800">{v}</dd>
          </div>
        ))}
      </dl>
      {caseFile.shipping?.address && (
        <p className="flex gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
          {[caseFile.shipping.recipient, caseFile.shipping.address].filter(Boolean).join(", ")}
        </p>
      )}
      <p className="flex items-center gap-2 text-xs text-zinc-600">
        <ShieldCheck className={cn("h-4 w-4", caseFile.sellerProtectionEligible ? "text-emerald-500" : "text-zinc-300")} />
        {caseFile.sellerProtectionEligible ? `Seller Protection: ${humanize(caseFile.sellerProtectionType)}` : "Not covered by Seller Protection"}
      </p>
    </Card>
  );
}
