// Shared building blocks for the whole app. Server-safe (no hooks).

import { initials, statusLabel } from "@/lib/format";
import { PRODUCTS } from "@/lib/catalog";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon, children, aside }: { icon?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-zinc-500 uppercase">
        {icon}
        {children}
      </h3>
      {aside}
    </div>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "WAITING_FOR_SELLER_RESPONSE" ? "red" : status === "RESOLVED" ? "neutral" : status === "UNDER_REVIEW" ? "blue" : "amber";
  return (
    <Badge tone={tone}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone === "red" ? "bg-rose-500" : tone === "blue" ? "bg-sky-500" : tone === "neutral" ? "bg-zinc-400" : "bg-amber-500")} />
      {statusLabel(status)}
    </Badge>
  );
}

const AVATAR_COLORS = ["bg-indigo-100 text-indigo-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700"];

export function Avatar({ name, className }: { name?: string; className?: string }) {
  const color = AVATAR_COLORS[(name ?? "").length % AVATAR_COLORS.length];
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", color, className)}>
      {initials(name)}
    </span>
  );
}

/** Square tile with the product's emoji on a warm gradient. */
export function ProductTile({ itemName, className }: { itemName?: string; className?: string }) {
  const product = PRODUCTS.find((p) => p.name === itemName);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 ring-1 ring-amber-200/60",
        className ?? "h-10 w-10 text-xl",
      )}
    >
      {product?.emoji ?? "📦"}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** Small horizontal win-chance bar used in lists. */
export function WinBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 60 ? "bg-emerald-500" : value >= 35 ? "bg-amber-500" : "bg-rose-500";
  return (
    <span className={cn("inline-block h-1.5 w-14 overflow-hidden rounded-full bg-zinc-200", className)}>
      <span className={cn("block h-full rounded-full", color)} style={{ width: `${value}%` }} />
    </span>
  );
}

/** Circular gauge for the win probability. */
export function WinGauge({ value, size = 132 }: { value: number; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = value >= 60 ? "#10b981" : value >= 35 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececf0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-zinc-900">{value}%</span>
        <span className="text-[11px] font-medium text-zinc-500">win chance</span>
      </div>
    </div>
  );
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50",
  success:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50",
  warning:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900",
};
