import { NextResponse } from "next/server";
import { listDisputes } from "@/lib/paypal";
import { errorResponse } from "@/lib/api-error";

export async function GET() {
  try {
    const data = await listDisputes();
    return NextResponse.json(data.items ?? []);
  } catch (err) {
    return errorResponse(err);
  }
}
