"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { defaultFeatureFlags, type FeatureFlags } from "@prostor/core";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";

export async function updateFeatureFlagAction(formData: FormData) {
  await requirePermission("settings", "write");
  const key = String(formData.get("key") ?? "") as keyof FeatureFlags;
  const enabled = formData.get("enabled") === "on";

  if (!(key in defaultFeatureFlags)) {
    throw new Error("Unknown feature flag.");
  }

  await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled },
    create: { key, enabled },
  });

  await logAdminActivity({
    entityType: "feature-flag",
    entityId: key,
    action: "settings.feature-flag.updated",
    summary: `Feature flag ${key} переключен на ${enabled ? "on" : "off"}.`,
    metadata: { key, enabled },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
}