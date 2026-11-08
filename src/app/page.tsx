import { Suspense } from "react";
import Link from "next/link";
import { after } from "next/server";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileSearch,
  Gavel,
  Inbox,
  Plus,
  Radar,
  Sparkles,
  Swords,
} from "lucide-react";
import { hasPayPalCredentials, listDisputes } from "@/lib/paypal";
import { loadCase } from "@/lib/dispute-service";
import { getAllRecords, type DisputeRecord } from "@/lib/store";
import type { DisputeSummary } from "@/lib/paypal-types";
import { ago, money, reasonLabel, usd } from "@/lib/format";
import { Badge, Card, ProductTile, Skeleton, StatusBadge, WinBar, buttonStyles, cn } from "@/components/ui";
import { SetupNotice } from "./setup-notice";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "action", label: "Needs action" },
  { key: "all", label: "All" },
  { key: "resolved", label: "Resolved" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "all";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">Disputes</h1>
          <p className="mt-1 text-zinc-500">Buyer complaints from PayPal. Open one and the copilot builds your case.</p>
        </div>
        <Link href="/store" className={buttonStyles.secondary}>
          <Plus className="h-4 w-4" />
          Create test dispute
        </Link>
      </header>

      <HowItWorks />

      {hasPayPalCredentials() ? (
        <Suspense fallback={<InboxSkeleton />}>
          <DisputeInbox view={view} />
        </Suspense>
      ) : (
        <SetupNotice />
      )}
    </div>
  );
}

async function DisputeInbox({ view }: { view: View }) {
  let disputes: DisputeSummary[] = [];
  try {
    disputes = (await listDisputes()).items ?? [];
  } catch (err) {
    return <SetupNotice message={err instanceof Error ? err.message : String(err)} />;
  }
  const records = await getAllRecords();

  const isDone = (d: DisputeSummary) => d.status === "RESOLVED" || Boolean(records[d.dispute_id]?.actions?.length);
  const open = disputes.filter((d) => d.status !== "RESOLVED");
  const needsAction = disputes.filter((d) => !isDone(d));
  const resolved = disputes.filter((d) => d.status === "RESOLVED");
  const atRisk = open.reduce((s, d) => s + Number(d.dispute_amount.value), 0);
  const fight = needsAction.filter((d) => records[d.dispute_id]?.analysis?.analysis.recommendation === "FIGHT");
  const fightValue = fight.reduce((s, d) => s + Number(d.dispute_amount.value), 0);
  const handled = disputes.filter((d) => records[d.dispute_id]?.actions?.length).length;

  const shown = view === "action" ? needsAction : view === "resolved" ? resolved : disputes;
  const counts: Record<View, number> = { action: needsAction.length, all: disputes.length, resolved: resolved.length };

  // Preload open disputes in the background so opening one is instant.
  after(() => Promise.allSettled(open.slice(0, 8).map((d) => loadCase(d.dispute_id))));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Inbox className="h-4 w-4" />} label="Open disputes" value={String(open.length)} hint={`${needsAction.length} need action`} />
        <Kpi icon={<CircleDollarSign className="h-4 w-4" />} label="Money at risk" value={usd(atRisk)} hint="held by PayPal" tone="rose" />
        <Kpi icon={<Swords className="h-4 w-4" />} label="Worth fighting" value={usd(fightValue)} hint={`${fight.length} strong case${fight.length === 1 ? "" : "s"}`} tone="emerald" />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Handled by copilot" value={String(handled)} hint={`${resolved.length} resolved in PayPal`} tone="indigo" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
          <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={v.key === "all" ? "/" : `/?view=${v.key}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  view === v.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                {v.label}
                <span className="ml-1.5 text-xs text-zinc-400">{counts[v.key]}</span>
              </Link>
            ))}
          </div>
          <span className="text-xs text-zinc-400">Live from PayPal Disputes API</span>
        </div>

        {shown.length === 0 ? (
          <EmptyState view={view} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {shown.map((d) => (
              <DisputeRow key={d.dispute_id} d={d} record={records[d.dispute_id]} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DisputeRow({ d, record }: { d: DisputeSummary; record?: DisputeRecord }) {
  const itemName = record?.meta?.itemName;
  return (
    <li>
      <Link href={`/disputes/${d.dispute_id}`} className="group flex items-center gap-4 px-4 py-4 transition hover:bg-zinc-50/80 sm:px-5">
        <ProductTile itemName={itemName} className="h-11 w-11 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-medium text-zinc-900">{itemName ?? reasonLabel(d.reason)}</span>
            {itemName && <Badge>{reasonLabel(d.reason)}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {record?.meta?.buyerName ?? "Buyer"} · opened {ago(d.create_time)} · <span className="font-mono text-xs">{d.dispute_id}</span>
          </p>
        </div>
        <div className="hidden w-40 justify-end md:flex">
          <Verdict record={record} />
        </div>
        <div className="hidden w-36 justify-end sm:flex">
          <StatusBadge status={d.status} />
        </div>
        <div className="w-20 text-right font-semibold tabular-nums text-zinc-900">{money(d.dispute_amount)}</div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
      </Link>
    </li>
  );
}

function Verdict({ record }: { record?: DisputeRecord }) {
  const last = record?.actions?.at(-1);
  if (last) {
    return (
      <Badge tone="green">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {last.type === "EVIDENCE_SUBMITTED" ? "Evidence sent" : "Refunded"}
      </Badge>
    );
  }
  const a = record?.analysis?.analysis;
  if (!a) {
    return (
      <Badge tone="violet">
        <Sparkles className="h-3.5 w-3.5" />
        Ready to analyze
      </Badge>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <Badge tone={a.recommendation === "FIGHT" ? "green" : "amber"}>{a.recommendation === "FIGHT" ? "Fight" : "Refund"}</Badge>
      <span className="flex items-center gap-1.5 text-xs font-medium tabular-nums text-zinc-600">
        <WinBar value={a.win_probability} />
        {a.win_probability}%
      </span>
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "zinc",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "zinc" | "rose" | "emerald" | "indigo";
}) {
  const iconTone = {
    zinc: "bg-zinc-100 text-zinc-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
  }[tone];
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconTone)}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>
    </Card>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Radar, title: "Detect", text: "New PayPal disputes appear here" },
    { icon: FileSearch, title: "Build the case", text: "Order, payment & tracking pulled in" },
    { icon: Sparkles, title: "AI verdict", text: "Fight or refund, with a win chance" },
    { icon: Gavel, title: "One-click action", text: "Evidence or refund sent to PayPal" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-200/80 lg:grid-cols-4">
      {steps.map(({ icon: Icon, title, text }, i) => (
        <div key={title} className="flex items-start gap-3 bg-white p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900">
              <span className="mr-1 text-zinc-400">{i + 1}.</span>
              {title}
            </p>
            <p className="text-xs text-zinc-500">{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ view }: { view: View }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        <Inbox className="h-6 w-6" />
      </span>
      <p className="mt-4 font-medium text-zinc-900">{view === "action" ? "You're all caught up" : "No disputes here yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">
        Make a purchase in the demo store, then open a dispute as the sandbox buyer. It shows up here within a minute or two.
      </p>
      <Link href="/store" className={cn(buttonStyles.primary, "mt-5")}>
        Go to demo store <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>
      <Card className="divide-y divide-zinc-100">
        <div className="px-5 py-3">
          <Skeleton className="h-8 w-64" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
