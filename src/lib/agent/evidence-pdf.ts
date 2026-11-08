// Builds a one-to-two page PDF "evidence packet" that is attached to the
// PayPal evidence submission: order, payment, shipping, carrier scans and the
// seller's letter, laid out so a PayPal reviewer can check it at a glance.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CaseFile } from "./case-file";

// The standard PDF fonts only cover basic Latin characters.
function clean(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildEvidencePdf(caseFile: CaseFile, letter: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const width = 612 - margin * 2;

  let page: PDFPage = pdf.addPage([612, 792]);
  let y = 792 - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([612, 792]);
      y = 792 - margin;
    }
  };
  const text = (t: string, opts: { size?: number; f?: PDFFont; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 10;
    for (const line of wrap(t, opts.f ?? font, size, width)) {
      ensure(size + 4);
      page.drawText(line, { x: margin, y, size, font: opts.f ?? font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
      y -= size + 4;
    }
  };
  const heading = (t: string) => {
    y -= 8;
    ensure(30);
    text(t, { size: 12, f: bold });
    page.drawLine({ start: { x: margin, y: y + 11 }, end: { x: margin + width, y: y + 11 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    y -= 2;
  };
  const row = (label: string, value?: string) => text(`${label}: ${value ?? "-"}`);
  const money = (m?: { value: string; currency_code: string }) => (m ? `${m.value} ${m.currency_code}` : "-");

  text("Seller Evidence Packet", { size: 18, f: bold });
  text(`PayPal dispute ${caseFile.disputeId}  |  Prepared ${new Date().toISOString().slice(0, 10)}`, { color: [0.4, 0.4, 0.4] });

  heading("1. Order");
  row("Order ID", caseFile.order?.id);
  for (const i of caseFile.order?.items ?? []) row(`Item`, `${i.quantity} x ${i.name} @ ${money(i.unitPrice)}`);

  heading("2. Payment");
  row("Transaction ID", caseFile.payment.transactionId);
  row("Amount", money(caseFile.payment.amount));
  row("Paid on", caseFile.payment.paidAt);
  row("Buyer", [caseFile.buyer.name, caseFile.buyer.email].filter(Boolean).join(" / "));

  heading("3. Shipping");
  row("Ship to", [caseFile.shipping?.recipient, caseFile.shipping?.address].filter(Boolean).join(", "));
  for (const t of caseFile.tracking) {
    row("Carrier / tracking", `${t.carrier} ${t.trackingNumber}`);
    row("Carrier status", t.deliveredAt ? `${t.status} on ${t.deliveredAt} (${t.deliveredTo})` : t.status);
    text("Scan history:", { f: bold });
    for (const e of t.events) text(`  ${e.time}   ${e.description}  -  ${e.location}`);
  }
  if (caseFile.tracking.length === 0) text("No tracking number on file.");

  heading("4. Buyer's claim");
  row("Reason", caseFile.reason);
  for (const c of caseFile.buyerClaims) text(`"${c.text}"`);

  heading("5. Seller's response");
  text(letter);

  return pdf.save();
}
