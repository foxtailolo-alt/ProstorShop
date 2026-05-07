import { NextResponse } from "next/server";
import { getActiveTradeInSnapshot } from "../../../../lib/data/pricing";
import { quoteTradeInSelection } from "../../../../lib/trade-in-snapshot";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const snapshot = await getActiveTradeInSnapshot();

  if (!snapshot) {
    return NextResponse.json({ error: "Active trade-in snapshot is not available." }, { status: 404 });
  }

  const categoryCode = typeof body?.categoryCode === "string" ? body.categoryCode : "";
  const modelCode = typeof body?.modelCode === "string" ? body.modelCode : "";
  const answers = body?.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
    ? Object.fromEntries(
        Object.entries(body.answers)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, String(value)]),
      ) as Record<string, string>
    : {};

  if (!categoryCode || !modelCode) {
    return NextResponse.json({ error: "Trade-in quote request is incomplete." }, { status: 400 });
  }

  try {
    const quote = await quoteTradeInSelection(snapshot, {
      categoryCode: categoryCode as Parameters<typeof quoteTradeInSelection>[1]["categoryCode"],
      modelCode,
      answers,
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("Trade-in quote failed", {
      categoryCode,
      modelCode,
      answers,
      error,
    });
    return NextResponse.json({ quote: null });
  }
}