"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { fulfillUsedDeviceWaitlistEntriesForOrder } from "../../../../lib/used-device-waitlist-notifications";
import { createAccessoryHintsForOrder } from "../../../../lib/accessory-notifications";

const allowedStatuses = new Set(["pending", "contacted", "confirmed", "completed", "cancelled"]);

export async function updateOrderStatusAction(formData: FormData) {
  await requirePermission("orders", "write");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!orderId || !allowedStatuses.has(status)) {
    throw new Error("Order status update is invalid.");
  }

  await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: orderId },
      include: {
        appliedPromoCode: true,
        pointTransactions: true,
      },
    });

    if (!order) {
      throw new Error("Order was not found.");
    }

    await transaction.order.update({
      where: { id: orderId },
      data: { status },
    });

    if (order.status === "completed" || status !== "completed") {
      return;
    }

    const existingCashback = order.pointTransactions.find((entry) => entry.kind === "cashback");
    const cashbackPoints = order.userId && !existingCashback ? Math.floor(Number(order.total) * 0.01) : 0;

    if (order.userId && cashbackPoints > 0) {
      await transaction.user.update({
        where: { id: order.userId },
        data: {
          loyaltyPoints: {
            increment: cashbackPoints,
          },
          pointTransactions: {
            create: {
              orderId: order.id,
              amount: cashbackPoints,
              kind: "cashback",
              description: `Кешбэк 1% за заказ ${order.id}`,
            },
          },
        },
      });

      await transaction.order.update({
        where: { id: order.id },
        data: {
          cashbackPointsAwarded: cashbackPoints,
        },
      });
    }

    const existingReferralReward = order.pointTransactions.find((entry) => entry.kind === "promo_referral_owner");
    const referralOwnerId = order.appliedPromoCode?.ownerUserId;
    const referralPercent = Number(order.appliedPromoCode?.ownerCashbackPercent ?? 0);
    const referralPoints = referralOwnerId && !existingReferralReward
      ? Math.floor(Number(order.total) * (referralPercent / 100))
      : 0;

    if (referralOwnerId && referralOwnerId !== order.userId && referralPoints > 0) {
      await transaction.user.update({
        where: { id: referralOwnerId },
        data: {
          loyaltyPoints: {
            increment: referralPoints,
          },
          pointTransactions: {
            create: {
              orderId: order.id,
              promoCodeId: order.appliedPromoCode?.id,
              amount: referralPoints,
              kind: "promo_referral_owner",
              description: `Награда за использование промокода ${order.appliedPromoCode?.code}`,
            },
          },
        },
      });
    }
  });

  if (status === "completed") {
    await fulfillUsedDeviceWaitlistEntriesForOrder(orderId).catch(() => null);
    await createAccessoryHintsForOrder(orderId).catch(() => null);
  }

  await logAdminActivity({
    entityType: "order",
    entityId: orderId,
    action: "order.status.updated",
    summary: `Статус заказа изменен на ${status}.`,
    metadata: { status },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/waitlist");
  revalidatePath("/admin/activity");
  revalidatePath("/profile");
}