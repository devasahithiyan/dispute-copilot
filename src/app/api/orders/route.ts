import { NextResponse } from "next/server";
import { findProduct } from "@/lib/catalog";
import { createOrder } from "@/lib/paypal";
import { errorResponse } from "@/lib/api-error";

// Creates a PayPal order for one product. Called by the PayPal button.
export async function POST(req: Request) {
  const { productId } = await req.json().catch(() => ({}));
  const product = findProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "Unknown product" }, { status: 400 });
  }

  try {
    const order = await createOrder(product);
    return NextResponse.json({ id: order.id });
  } catch (err) {
    return errorResponse(err);
  }
}
