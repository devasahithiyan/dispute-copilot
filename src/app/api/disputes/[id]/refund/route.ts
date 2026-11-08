import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { acceptClaim, getDispute, invalidateDispute } from "@/lib/paypal";
import { addAction } from "@/lib/store";

// Accepts the buyer's claim, which refunds them through PayPal.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const note = String(body.note ?? "").trim() || "We have refunded your payment in full. Sorry for the trouble.";

  try {
    const dispute = await getDispute(id);
    if (dispute.status === "RESOLVED") {
      return NextResponse.json({ error: "This dispute is already resolved." }, { status: 409 });
    }
    await acceptClaim(id, note);
    invalidateDispute(id);
    await addAction(id, {
      type: "REFUND_ACCEPTED",
      at: new Date().toISOString(),
      detail: `Accepted claim and refunded ${dispute.dispute_amount.value} ${dispute.dispute_amount.currency_code}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
