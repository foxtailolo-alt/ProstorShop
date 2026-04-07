import { prisma, type Prisma } from "@prostor/db";
import { getSession } from "./auth/session";

type AuditInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export async function logAdminActivity(input: AuditInput) {
  const session = await getSession();

  await prisma.activityLog.create({
    data: {
      userId: session?.user.id ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
}

function formatMetadataValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  return null;
}

export function getAuditMetadataEntries(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata)
    .map(([key, value]) => {
      const formatted = formatMetadataValue(value);

      return formatted ? { key, value: formatted } : null;
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
}