import "server-only";
import { analyzeCase } from "./agent/analyze";
import { buildCaseFile } from "./agent/case-file";
import { getDisputeContext } from "./paypal";
import { saveAnalysis, saveMeta } from "./store";

/** Pulls everything from PayPal and returns the case file plus raw context. */
export async function loadCase(disputeId: string) {
  const ctx = await getDisputeContext(disputeId);
  const caseFile = buildCaseFile(ctx.dispute, ctx.capture, ctx.order);
  await saveMeta(disputeId, {
    buyerName: caseFile.buyer.name,
    itemName: caseFile.order?.items[0]?.name ?? ctx.dispute.disputed_transactions?.[0]?.items?.[0]?.item_name,
  });
  return { ...ctx, caseFile };
}

/** Full agent run: gather evidence, ask the AI, store the result. */
export async function runAnalysis(disputeId: string) {
  const { dispute, caseFile } = await loadCase(disputeId);
  const result = await analyzeCase(caseFile);
  result.disputeUpdatedAt = dispute.update_time;
  await saveAnalysis(disputeId, result);
  return { result, caseFile };
}
