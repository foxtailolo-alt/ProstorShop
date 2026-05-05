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
  const snapshotVersion = Number(formData.get("snapshotVersion") ?? 0) || null;
  const categoryCode = String(formData.get("categoryCode") ?? "").trim() || null;
  const deviceModelCode = String(formData.get("deviceModelCode") ?? "").trim() || null;
  const saveToProfile = String(formData.get("saveToProfile") ?? "").trim() === "1";
  const answersJsonValue = String(formData.get("answersJson") ?? "").trim();
  const quote = Number(formData.get("quote") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  let answersJson: Record<string, string> | null = null;
  if (answersJsonValue) {
    try {
      const parsed = JSON.parse(answersJsonValue) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        answersJson = Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === "string"),
        );
      }
    } catch {
      answersJson = null;
    }
  }

  if (!customerName || !phone || !brand || !model || !condition || !Number.isFinite(quote) || quote < 0) {
    throw new Error("Trade-in request form is incomplete.");
  }

  const [session, attribution] = await Promise.all([getSession(), getAttributionSnapshot()]);

  const request = await prisma.$transaction(async (transaction) => {
    const createdRequest = await transaction.tradeInRequest.create({
      data: {
        userId: session?.user.id ?? null,
        customerName,
        phone,
        brand,
        model,
        storage,
        condition,
        snapshotVersion,
        categoryCode,
        deviceModelCode,
        answersJson: answersJson ?? undefined,
        quote,
        note: note || null,
        attribution: attribution ?? undefined,
      },
    });

    if (session?.user.id && saveToProfile && categoryCode) {
      await transaction.userDevice.create({
        data: {
          userId: session.user.id,
          sourceKind: "trade-in",
          categoryCode,
          brand,
          model,
          deviceModelCode,
          storage,
          condition,
          estimatedTradeInValue: quote,
          lastTradeInSnapshotVersion: snapshotVersion,
          answersJson: answersJson ?? undefined,
          tradeInRequestId: createdRequest.id,
        },
      });
    }

    return createdRequest;
  });

  revalidatePath("/trade-in");
  revalidatePath("/admin/trade-in");
  revalidatePath("/admin");
  revalidatePath("/profile");
  redirect(`/trade-in?success=1&requestId=${request.id}`);
}