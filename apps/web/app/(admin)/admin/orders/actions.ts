"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";

const allowedStatuses = new Set(["pending", "contacted", "confirmed", "completed", "cancelled"]);

export async function updateOrderStatusAction(formData: FormData) {
  await requirePermission("orders", "write");
  const orderId = String(formData.get("orderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!orderId || !allowedStatuses.has(status)) {
    throw new Error("Order status update is invalid.");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  await logAdminActivity({
    entityType: "order",
    entityId: orderId,
    action: "order.status.updated",
    summary: `Статус заказа изменен на ${status}.`,
    metadata: { status },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/activity");
}