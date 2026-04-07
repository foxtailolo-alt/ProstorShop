"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getAttributionSnapshot } from "../../../lib/attribution";
import { getSession } from "../../../lib/auth/session";

export async function submitTradeInRequestAction(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const condition = String(formData.get("condition") ?? "").trim();
  const quote = Number(formData.get("quote") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!customerName || !phone || !brand || !model || !condition || !Number.isFinite(quote) || quote < 0) {
    throw new Error("Trade-in request form is incomplete.");
  }

  const [session, attribution] = await Promise.all([getSession(), getAttributionSnapshot()]);

  const request = await prisma.tradeInRequest.create({
    data: {
      userId: session?.user.id ?? null,
      customerName,
      phone,
      brand,
      model,
      storage,
      condition,
      quote,
      note: note || null,
      attribution: attribution ?? undefined,
    },
  });

  revalidatePath("/trade-in");
  revalidatePath("/admin/trade-in");
  revalidatePath("/admin");
  redirect(`/trade-in?success=1&requestId=${request.id}`);
}