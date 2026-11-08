import { NextResponse } from "next/server";
import { getDisputeContext } from "@/lib/paypal";
import { errorResponse } from "@/lib/api-error";

// Returns the dispute plus its payment and original order.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await getDisputeContext(id));
  } catch (err) {
    return errorResponse(err);
  }
}
