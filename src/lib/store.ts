import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { AnalysisResult } from "./agent/analyze";

// A tiny JSON-file store: AI analyses, actions taken, a short summary of each
// dispute for the dashboard, and capture -> order links saved at checkout.
// Good enough for a single-seller demo; swap for a database later.

export interface ActionRecord {
  type: "EVIDENCE_SUBMITTED" | "REFUND_ACCEPTED";
  at: string;
  detail: string;
}

export interface DisputeMeta {
  buyerName?: string;
  itemName?: string;
}

export interface DisputeRecord {
  analysis?: AnalysisResult;
  actions?: ActionRecord[];
  meta?: DisputeMeta;
}

interface Db {
  disputes: Record<string, DisputeRecord>;
  orderLinks: Record<string, string>;
}

const FILE = path.join(process.cwd(), "data", "disputes.json");
const g = globalThis as typeof globalThis & { __db?: Db; __dbWrite?: Promise<void> };

async function db(): Promise<Db> {
  if (g.__db) return g.__db;
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8"));
    // Older files stored disputes at the top level.
    g.__db = raw.disputes ? { orderLinks: {}, ...raw } : { disputes: raw, orderLinks: {} };
  } catch {
    g.__db = { disputes: {}, orderLinks: {} };
  }
  return g.__db!;
}

async function persist() {
  const data = await db();
  // Writes are chained so two quick saves never interleave.
  g.__dbWrite = (g.__dbWrite ?? Promise.resolve()).then(async () => {
    try {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      // Read-only hosts: keep working from memory instead of failing the request.
      console.warn("Could not save data/disputes.json, keeping it in memory only:", (err as Error).message);
    }
  });
  await g.__dbWrite;
}

export async function getRecord(disputeId: string): Promise<DisputeRecord> {
  return (await db()).disputes[disputeId] ?? {};
}

export async function getAllRecords() {
  return (await db()).disputes;
}

async function update(disputeId: string, fn: (r: DisputeRecord) => DisputeRecord) {
  const d = await db();
  d.disputes[disputeId] = fn(d.disputes[disputeId] ?? {});
  await persist();
}

export function saveAnalysis(disputeId: string, analysis: AnalysisResult) {
  return update(disputeId, (r) => ({ ...r, analysis }));
}

export function addAction(disputeId: string, action: ActionRecord) {
  return update(disputeId, (r) => ({ ...r, actions: [...(r.actions ?? []), action] }));
}

export async function saveMeta(disputeId: string, meta: DisputeMeta) {
  const current = (await getRecord(disputeId)).meta;
  if (current?.buyerName === meta.buyerName && current?.itemName === meta.itemName) return;
  await update(disputeId, (r) => ({ ...r, meta }));
}

export async function getOrderIdForCapture(captureId: string) {
  return (await db()).orderLinks[captureId];
}

export async function saveOrderLink(captureId: string, orderId: string) {
  const d = await db();
  if (d.orderLinks[captureId] === orderId) return;
  d.orderLinks[captureId] = orderId;
  await persist();
}
