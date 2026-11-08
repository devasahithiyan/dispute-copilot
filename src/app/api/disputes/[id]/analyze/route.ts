import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-error";
import { runAnalysis } from "@/lib/dispute-service";

export const maxDuration = 60;

// Runs the AI agent on one dispute and stores the result.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { result } = await runAnalysis(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Groq")) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return errorResponse(err);
  }
}
