import { errorResponse } from "@/lib/api-error";
import { buildEvidencePdf } from "@/lib/agent/evidence-pdf";
import { loadCase } from "@/lib/dispute-service";
import { getRecord } from "@/lib/store";

// Preview of the PDF evidence packet that gets attached on submission.
// GET uses the saved AI draft; POST { letter } renders the seller's edited text.

async function render(id: string, letter?: string) {
  const { caseFile } = await loadCase(id);
  const text =
    letter?.trim() ||
    (await getRecord(id)).analysis?.analysis.evidence_letter ||
    "(Letter not drafted yet. Run the AI analysis first.)";
  const pdf = await buildEvidencePdf(caseFile, text);
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="evidence-${id}.pdf"`,
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return await render(id);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    return await render(id, typeof body.letter === "string" ? body.letter : undefined);
  } catch (err) {
    return errorResponse(err);
  }
}
