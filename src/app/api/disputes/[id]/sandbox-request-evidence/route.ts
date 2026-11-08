import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { sandboxRequestSellerEvidence } from "@/lib/paypal";

// Sandbox-only: moves a dispute that PayPal put "under review" back to
// "waiting for seller response" so evidence can be submitted in the demo.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await sandboxRequestSellerEvidence(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
