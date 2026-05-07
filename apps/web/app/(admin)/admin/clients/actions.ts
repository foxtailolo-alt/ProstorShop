"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";

function parsePointsAmount(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function adjustCustomerPointsAction(formData: FormData) {
  await requirePermission("clients", "write");

  const userId = String(formData.get("userId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "credit").trim();
  const amount = parsePointsAmount(String(formData.get("amount") ?? ""));
  const note = String(formData.get("note") ?? "").trim();

  if (!userId || !amount || (direction !== "credit" && direction !== "debit")) {
    throw new Error("Некорректные параметры изменения баллов.");
  }

  await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        loyaltyPoints: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        phone: true,
      },
    });

    if (!user) {
      throw new Error("Клиент не найден.");
    }

    const signedAmount = direction === "credit" ? amount : -amount;
    const nextBalance = user.loyaltyPoints + signedAmount;

    if (nextBalance < 0) {
      throw new Error("Нельзя списать больше баллов, чем есть у клиента.");
    }

    await transaction.user.update({
      where: { id: userId },
      data: {
        loyaltyPoints: nextBalance,
        pointTransactions: {
          create: {
            amount: signedAmount,
            kind: direction === "credit" ? "manual_credit" : "manual_debit",
            description: note || (direction === "credit" ? "Начисление из админки" : "Списание из админки"),
          },
        },
      },
    });

    const customerName = [user.firstName, user.lastName].filter(Boolean).join(" ")
      || user.telegramUsername
      || user.phone
      || user.id;

    await logAdminActivity({
      entityType: "customer",
      entityId: userId,
      action: "customer.points.adjusted",
      summary: `${direction === "credit" ? "Начислено" : "Списано"} ${amount} баллов для ${customerName}.`,
      metadata: {
        direction,
        amount,
        note: note || null,
        nextBalance,
      },
    });
  });

  revalidatePath("/admin/clients");
}