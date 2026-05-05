"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";

const allowedStatuses = new Set(["active", "matched", "fulfilled", "cancelled"]);

export async function updateUsedDeviceWaitlistStatusAction(formData: FormData) {
  await requirePermission("products", "write");

  const entryId = String(formData.get("entryId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!entryId || !allowedStatuses.has(status)) {
    throw new Error("Статус списка ожидания указан неверно.");
  }

  const entry = await prisma.usedDeviceWaitlistEntry.update({
    where: { id: entryId },
    data: { status },
  });

  await logAdminActivity({
    entityType: "used-device-waitlist",
    entityId: entry.id,
    action: "waitlist.status.updated",
    summary: `Статус списка ожидания для ${entry.model} изменен на ${status}.`,
    metadata: { status, categoryCode: entry.categoryCode },
  });

  revalidatePath("/admin/waitlist");
  revalidatePath("/profile");
}