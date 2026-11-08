import { NextResponse } from "next/server";
import { PayPalError } from "./paypal";

export function errorResponse(err: unknown) {
  if (err instanceof PayPalError) {
    return NextResponse.json(
      { error: err.message, details: err.details, debugId: err.debugId },
      { status: err.status },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}
