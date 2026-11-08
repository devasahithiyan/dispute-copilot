"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/agent/analyze";
import type { ActionRecord } from "@/lib/store";
import { Badge, Card, SectionTitle, WinGauge, buttonStyles, cn } from "@/components/ui";

const STEPS = [
  "Reading the dispute from PayPal",
  "Pulling the order and payment",
  "Checking shipment tracking",
  "Weighing the evidence with AI",
  "Drafting your response",
];

interface Props {
  disputeId: string;
  status: string;
  amountLabel: string;
  buyerName?: string;
  submitMode: "evidence" | "supporting-info" | null;
  initial: AnalysisResult | null;
  actions: ActionRecord[];
}

type Pending = { kind: "evidence" } | { kind: "refund" } | null;

export function AgentPanel({ disputeId, status, amountLabel, buyerName, submitMode, initial, actions }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(initial);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState(initial?.analysis.evidence_letter ?? "");
  const [buyerMsg, setBuyerMsg] = useState(initial?.analysis.buyer_message ?? "");
  const [tab, setTab] = useState<"letter" | "pdf">("letter");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [forceRefund, setForceRefund] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const started = useRef(false);

  // Build the PDF from the letter as currently edited whenever the tab opens.
  useEffect(() => {
    if (tab !== "pdf") return;
    let url: string | null = null;
    let cancelled = false;
    setPdfLoading(true);
    fetch(`/api/disputes/${disputeId}/evidence-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ letter }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .finally(() => !cancelled && setPdfLoading(false));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const resolved = status === "RESOLVED";
  const done = actions.length > 0;

  async function analyze() {
    setRunning(true);
    setError(null);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
      setLetter(data.analysis.evidence_letter);
      setBuyerMsg(data.analysis.buyer_message);
      setForceRefund(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  }

  // The agent starts on its own the first time a dispute is opened.
  useEffect(() => {
    if (!initial && !resolved && !done && !started.current) {
      started.current = true;
      analyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(kind: "evidence" | "refund") {
    setBusy(true);
    setError(null);
    try {
      const path = kind === "evidence" ? "submit-evidence" : "refund";
      const body =
        kind === "evidence"
          ? { letter, evidenceType: result?.analysis.paypal_evidence_type }
          : { note: buyerMsg || "We have refunded your payment in full. Sorry for the trouble." };
      const res = await fetch(`/api/disputes/${disputeId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- states ---------- */

  if (running) return <Working step={step} />;

  if (!result) {
    return (
      <Card className="flex flex-col items-center p-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Sparkles className="h-6 w-6" />
        </span>
        <p className="mt-4 font-medium text-zinc-900">{done || resolved ? "This dispute is closed" : "Let the copilot review this dispute"}</p>
        {error && <ErrorNote message={error} />}
        {!resolved && (
          <button onClick={analyze} className={cn(buttonStyles.primary, "mt-5")}>
            <Sparkles className="h-4 w-4" /> Analyze with AI
          </button>
        )}
      </Card>
    );
  }

  const a = result.analysis;
  const fight = a.recommendation === "FIGHT" && !forceRefund;
  const words = letter.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <Card className="overflow-hidden">
        <div className={cn("h-1 w-full", a.recommendation === "FIGHT" ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-amber-400 to-orange-500")} />
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <WinGauge value={a.win_probability} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-indigo-600 uppercase">
                <Sparkles className="h-3.5 w-3.5" /> Copilot recommends
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-lg px-2.5 py-1 text-sm font-semibold",
                  a.recommendation === "FIGHT" ? "bg-emerald-600 text-white" : "bg-amber-500 text-white",
                )}
              >
                {a.recommendation === "FIGHT" ? "Fight this dispute" : "Refund the buyer"}
              </span>
              <Badge>{a.confidence.toLowerCase()} confidence</Badge>
            </div>
            <h2 className="text-xl leading-snug font-semibold tracking-tight text-zinc-900">{a.headline}</h2>
            <p className="text-sm leading-relaxed text-zinc-600">{a.summary}</p>
          </div>
        </div>

        <div className="grid gap-6 border-t border-zinc-100 p-6 md:grid-cols-2">
          <div className="space-y-3">
            <SectionTitle>Why</SectionTitle>
            <ul className="space-y-2.5">
              {a.reasoning.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-zinc-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <SectionTitle>Evidence found</SectionTitle>
            <ul className="space-y-3">
              {a.evidence.map((e, i) => (
                <li key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-800">{e.label}</span>
                    <Strength level={e.strength} />
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-500">{e.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {(a.fraud_signals.length > 0 || a.missing_evidence.length > 0) && (
          <div className="grid gap-3 border-t border-zinc-100 p-6 md:grid-cols-2">
            {a.fraud_signals.length > 0 && (
              <Callout tone="red" icon={<AlertTriangle className="h-4 w-4" />} title="Red flags" items={a.fraud_signals} />
            )}
            {a.missing_evidence.length > 0 && (
              <Callout tone="zinc" icon={<Lightbulb className="h-4 w-4" />} title="Would strengthen the case" items={a.missing_evidence} />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3 text-xs text-zinc-500">
          <span>
            {result.model} via Groq · {(result.latencyMs / 1000).toFixed(1)}s
          </span>
          {!done && !resolved && (
            <button onClick={analyze} className={buttonStyles.ghost}>
              <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
            </button>
          )}
        </div>
      </Card>

      {/* Response */}
      {done || resolved ? (
        <Done actions={actions} resolved={resolved} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4">
            <div>
              <h3 className="font-semibold text-zinc-900">Your response</h3>
              <p className="text-xs text-zinc-500">
                {fight ? "Drafted by the copilot. Edit anything before sending." : `Refund ${amountLabel} to ${buyerName ?? "the buyer"} with a short note.`}
              </p>
            </div>
            {fight && (
              <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
                {(["letter", "pdf"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                      tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
                    )}
                  >
                    {t === "letter" ? <PenLine className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    {t === "letter" ? "Letter" : "PDF packet"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-6">
            {fight ? (
              tab === "letter" ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
                  <textarea
                    value={letter}
                    onChange={(e) => setLetter(e.target.value)}
                    rows={14}
                    className="block w-full resize-y rounded-xl bg-transparent p-4 text-[15px] leading-7 text-zinc-800 outline-none"
                  />
                  <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500">
                    <span>{words} words</span>
                    <span>
                      Sent as <code className="font-mono">{a.paypal_evidence_type}</code> + tracking + PDF
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-zinc-600">
                      <FileText className="h-4 w-4 text-zinc-400" />
                      evidence-{disputeId}.pdf · built from your current letter
                    </span>
                    {pdfUrl && (
                      <a href={pdfUrl} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>
                        Open in new tab <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {pdfLoading || !pdfUrl ? (
                    <div className="skeleton h-[480px] w-full rounded-xl" />
                  ) : (
                    <object data={pdfUrl} type="application/pdf" className="h-[480px] w-full rounded-xl border border-zinc-200 bg-zinc-100">
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-zinc-500">
                        <FileText className="h-8 w-8 text-zinc-300" />
                        This browser can&apos;t show PDFs inline. Use &ldquo;Open in new tab&rdquo; above.
                      </div>
                    </object>
                  )}
                </div>
              )
            ) : (
              <textarea
                value={buyerMsg}
                onChange={(e) => setBuyerMsg(e.target.value)}
                rows={5}
                placeholder="A short note to the buyer"
                className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-[15px] leading-7 text-zinc-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
              />
            )}
            {fight && submitMode === "supporting-info" && (
              <p className="mt-3 text-xs text-zinc-500">
                PayPal is already reviewing this case, so your letter and PDF go straight to PayPal&apos;s review team.
              </p>
            )}
            {fight && !submitMode && (
              <p className="mt-3 text-xs text-amber-700">PayPal isn&apos;t accepting seller evidence for this dispute right now.</p>
            )}
            {error && <ErrorNote message={error} />}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
            {fight ? (
              <>
                <button onClick={() => setForceRefund(true)} className={buttonStyles.ghost}>
                  <RotateCcw className="h-3.5 w-3.5" /> Refund instead
                </button>
                <button onClick={() => setConfirm({ kind: "evidence" })} disabled={!submitMode || words < 5} className={buttonStyles.success}>
                  <Send className="h-4 w-4" /> Approve & send to PayPal
                </button>
              </>
            ) : (
              <>
                {a.recommendation === "FIGHT" ? (
                  <button onClick={() => setForceRefund(false)} className={buttonStyles.ghost}>
                    <PenLine className="h-3.5 w-3.5" /> Back to the evidence letter
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500">PayPal returns the money to the buyer and closes the case.</span>
                )}
                <button onClick={() => setConfirm({ kind: "refund" })} className={buttonStyles.warning}>
                  <RotateCcw className="h-4 w-4" /> Approve refund of {amountLabel}
                </button>
              </>
            )}
          </div>
        </Card>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === "evidence" ? "Send your evidence to PayPal?" : `Refund ${amountLabel}?`}
          body={
            confirm.kind === "evidence" ? (
              <ul className="space-y-2 text-sm text-zinc-600">
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> Your letter ({words} words)</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> PDF evidence packet with order, payment and tracking</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> {submitMode === "evidence" ? "Tracking number as proof of fulfillment" : "Sent to PayPal's review team"}</li>
              </ul>
            ) : (
              <p className="text-sm text-zinc-600">
                PayPal will return {amountLabel} to {buyerName ?? "the buyer"} and close the dispute. This can&apos;t be undone.
              </p>
            )
          }
          confirmLabel={confirm.kind === "evidence" ? "Send now" : "Refund now"}
          tone={confirm.kind === "evidence" ? "success" : "warning"}
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => send(confirm.kind)}
        />
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function Working({ step }: { step: number }) {
  return (
    <Card className="relative overflow-hidden p-6">
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-indigo-100">
        <div className="h-full w-1/3 animate-[shimmer_1.2s_linear_infinite] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" style={{ backgroundSize: "400px 100%" }} />
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-semibold text-zinc-900">Copilot is building your case</p>
          <p className="text-sm text-zinc-500">This usually takes 5 to 10 seconds.</p>
        </div>
      </div>
      <ol className="mt-6 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-3 text-sm transition", i > step && "opacity-40")}>
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full",
                i < step ? "bg-emerald-100 text-emerald-600" : i === step ? "bg-indigo-100 text-indigo-600" : "bg-zinc-100 text-zinc-400",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className={i === step ? "font-medium text-zinc-900" : "text-zinc-600"}>{s}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Done({ actions, resolved }: { actions: ActionRecord[]; resolved: boolean }) {
  const last = actions.at(-1);
  const refunded = last?.type === "REFUND_ACCEPTED";
  return (
    <Card className="flex gap-4 p-6 animate-pop">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold text-zinc-900">
          {last ? (refunded ? "Buyer refunded through PayPal" : "Evidence sent to PayPal") : "Dispute resolved"}
        </p>
        {last && <p className="text-sm text-zinc-600">{last.detail}</p>}
        <p className="text-xs text-zinc-400">
          {last && new Date(last.at).toLocaleString()} {resolved ? "· PayPal shows this case as resolved" : "· PayPal will update the case status here"}
        </p>
      </div>
    </Card>
  );
}

function Strength({ level }: { level: string }) {
  const n = level === "STRONG" ? 3 : level === "MODERATE" ? 2 : 1;
  const color = n === 3 ? "bg-emerald-500" : n === 2 ? "bg-amber-400" : "bg-zinc-300";
  return (
    <span className="flex items-center gap-1.5" title={level.toLowerCase()}>
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2 w-4 rounded-sm", i <= n ? color : "bg-zinc-200")} />
        ))}
      </span>
      <span className="w-14 text-[11px] text-zinc-500">{level.toLowerCase()}</span>
    </span>
  );
}

function Callout({ tone, icon, title, items }: { tone: "red" | "zinc"; icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className={cn("rounded-xl p-4 text-sm", tone === "red" ? "bg-rose-50 text-rose-900" : "bg-zinc-50 text-zinc-700")}>
      <p className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={cn("mt-2 h-1 w-1 shrink-0 rounded-full", tone === "red" ? "bg-rose-400" : "bg-zinc-400")} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone: "success" | "warning";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm animate-fade-in" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button onClick={onCancel} disabled={busy} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{body}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className={buttonStyles.secondary}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className={tone === "success" ? buttonStyles.success : buttonStyles.warning}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? "Sending to PayPal…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
