import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth/session";
import { getPromoCodeSummary } from "../../../../lib/promo";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  if (!body?.code) {
    return NextResponse.json({ error: "Введите промокод." }, { status: 400 });
  }

  const session = await getSession();
  try {
    const summary = await getPromoCodeSummary(body.code, session?.user.id ?? null, { scope: "trade-in" });
    const amount = summary.discountKind === "flat" ? summary.discountValue : 0;
    const percent = summary.discountKind === "percent" ? summary.discountValue : 0;

    return NextResponse.json({
      ok: true,
      promoCode: {
        id: summary.id,
        code: summary.code,
        discountKind: summary.discountKind,
        amount,
        percent,
        rewardDescription: summary.rewardDescription,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Промокод не подошёл." },
      { status: 400 },
    );
  }
}
