import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { buildEvidencePdf } from "@/lib/agent/evidence-pdf";
import { PAYPAL_EVIDENCE_TYPES } from "@/lib/agent/analyze";
import { loadCase } from "@/lib/dispute-service";
import { provideEvidence, provideSupportingInfo, submissionMode, invalidateDispute } from "@/lib/paypal";
import { addAction } from "@/lib/store";

// Sends the seller-approved letter and a PDF evidence packet to PayPal.
// - Waiting for the seller: provide-evidence (with tracking info).
// - Already under PayPal review: provide-supporting-info.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const letter = String(body.letter ?? "").trim();
  const evidenceType = PAYPAL_EVIDENCE_TYPES.includes(body.evidenceType) ? body.evidenceType : "PROOF_OF_FULFILLMENT";
  if (letter.length < 20) {
    return NextResponse.json({ error: "The evidence letter is empty or too short." }, { status: 400 });
  }

  try {
    const { dispute, caseFile } = await loadCase(id);
    const mode = submissionMode(dispute);
    if (!mode) {
      return NextResponse.json(
        { error: `PayPal is not accepting seller evidence for this dispute right now (status: ${dispute.status}).` },
        { status: 409 },
      );
    }

    const pdf = await buildEvidencePdf(caseFile, letter);
    const document = { name: `evidence-${id}.pdf`, bytes: pdf };

    if (mode === "evidence") {
      await provideEvidence(id, {
        evidenceType,
        notes: letter,
        tracking: caseFile.tracking.map((t) => ({ carrier: t.carrier, number: t.trackingNumber })),
        document,
      });
    } else {
      await provideSupportingInfo(id, { notes: letter, document });
    }

    invalidateDispute(id);
    await addAction(id, {
      type: "EVIDENCE_SUBMITTED",
      at: new Date().toISOString(),
      detail:
        mode === "evidence"
          ? `${evidenceType} with letter, ${caseFile.tracking.length} tracking number(s) and a PDF evidence packet`
          : "Letter and PDF evidence packet sent to PayPal's review team (supporting info)",
    });
    return NextResponse.json({ ok: true, mode });
  } catch (err) {
    return errorResponse(err);
  }
}
