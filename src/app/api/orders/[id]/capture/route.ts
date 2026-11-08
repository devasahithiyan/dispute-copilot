import { NextResponse } from "next/server";
import { fakeTrackingNumber, type ShippingOutcome } from "@/lib/catalog";
import { addTracking, captureOrder } from "@/lib/paypal";
import { errorResponse } from "@/lib/api-error";
import { saveOrderLink } from "@/lib/store";

// Captures the buyer's payment, then "ships" the order by attaching a
// tracking number, so the dispute agent later has shipping evidence to use.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const outcome: ShippingOutcome = ["delivered", "in_transit", "returned"].includes(body.outcome) ? body.outcome : "delivered";
  const shipTracking = body.outcome !== "none";
  try {
    const order = await captureOrder(id);
    const capture = order.purchase_units[0]?.payments?.captures?.[0];
    if (!capture) {
      return NextResponse.json({ error: "Order captured but no capture id returned" }, { status: 502 });
    }

    await saveOrderLink(capture.id, order.id);

    const trackingNumber = fakeTrackingNumber(outcome);
    let trackingError: string | null = shipTracking ? null : "skipped (no-tracking demo)";
    if (shipTracking) {
      try {
        await addTracking(order.id, capture.id, trackingNumber);
      } catch (err) {
        // Payment still succeeded; report the tracking problem instead of failing.
        trackingError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json({
      orderId: order.id,
      captureId: capture.id,
      amount: capture.amount,
      status: capture.status,
      trackingNumber: trackingError ? null : trackingNumber,
      trackingError,
      payerEmail: order.payer?.email_address ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
