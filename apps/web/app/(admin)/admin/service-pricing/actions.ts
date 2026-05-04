"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { parseServiceCatalogWorkbook } from "../../../../lib/service-catalog";
import { requirePermission } from "../../../../lib/auth/session";

const serviceRequestStatuses = new Set(["new", "contacted", "accepted", "completed", "cancelled"]);

export async function importServicePricingAction(formData: FormData) {
  const session = await requirePermission("service", "write");
  const file = formData.get("priceFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Файл прайса не выбран.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseServiceCatalogWorkbook(buffer, file.name);

  await prisma.$transaction(async (transaction) => {
    await transaction.serviceCatalogVariant.updateMany({ data: { isActive: false } });
    await transaction.serviceCatalogModel.updateMany({ data: { isActive: false } });
    await transaction.serviceCatalogService.updateMany({ data: { isActive: false } });

    const serviceIds = new Map<string, string>();
    const modelIds = new Map<string, string>();

    for (const record of parsed.records) {
      if (!serviceIds.has(record.serviceSlug)) {
        const service = await transaction.serviceCatalogService.upsert({
          where: { slug: record.serviceSlug },
          update: {
            name: record.serviceName,
            description: record.serviceDescription,
            sortOrder: record.serviceSortOrder,
            isActive: true,
          },
          create: {
            slug: record.serviceSlug,
            name: record.serviceName,
            description: record.serviceDescription,
            sortOrder: record.serviceSortOrder,
            isActive: true,
          },
        });

        serviceIds.set(record.serviceSlug, service.id);
      }

      const serviceId = serviceIds.get(record.serviceSlug);
      if (!serviceId) {
        throw new Error(`Не удалось создать сервис ${record.serviceSlug}.`);
      }

      const modelKey = `${record.serviceSlug}::${record.modelSlug}`;
      if (!modelIds.has(modelKey)) {
        const model = await transaction.serviceCatalogModel.upsert({
          where: {
            serviceId_slug: {
              serviceId,
              slug: record.modelSlug,
            },
          },
          update: {
            brand: record.brand,
            name: record.modelName,
            sortOrder: record.modelSortOrder,
            isActive: true,
          },
          create: {
            serviceId,
            slug: record.modelSlug,
            brand: record.brand,
            name: record.modelName,
            sortOrder: record.modelSortOrder,
            isActive: true,
          },
        });

        modelIds.set(modelKey, model.id);
      }

      const modelId = modelIds.get(modelKey);
      if (!modelId) {
        throw new Error(`Не удалось создать модель ${record.modelName}.`);
      }

      await transaction.serviceCatalogVariant.upsert({
        where: {
          modelId_slug: {
            modelId,
            slug: record.variantSlug,
          },
        },
        update: {
          name: record.variantName,
          description: record.variantDescription,
          sourceKinds: record.sourceKinds,
          metadata: record.metadata as Prisma.InputJsonValue,
          sortOrder: record.variantSortOrder,
          partPrice: record.partPrice,
          laborPrice: record.laborPrice,
          totalPrice: record.totalPrice,
          currency: record.currency,
          sourceFile: record.sourceFile,
          sourceLabel: record.sourceLabel,
          isActive: true,
        },
        create: {
          modelId,
          slug: record.variantSlug,
          name: record.variantName,
          description: record.variantDescription,
          sourceKinds: record.sourceKinds,
          metadata: record.metadata as Prisma.InputJsonValue,
          sortOrder: record.variantSortOrder,
          partPrice: record.partPrice,
          laborPrice: record.laborPrice,
          totalPrice: record.totalPrice,
          currency: record.currency,
          sourceFile: record.sourceFile,
          sourceLabel: record.sourceLabel,
          isActive: true,
        },
      });
    }

    await transaction.serviceCatalogImportLog.create({
      data: {
        sourceFile: file.name,
        summary: {
          rowsRead: parsed.rowsRead,
          normalizedRows: parsed.normalizedRows,
          warnings: parsed.warnings,
          importedByUserId: session.user.id,
        },
      },
    });
  }, {
    maxWait: 10_000,
    timeout: 120_000,
  });

  await logAdminActivity({
    entityType: "service-catalog-import",
    action: "service.pricing.imported",
    summary: `Импортирован сервисный прайс ${file.name} с ${parsed.normalizedRows} вариантами.`,
    metadata: {
      fileName: file.name,
      rowsRead: parsed.rowsRead,
      normalizedRows: parsed.normalizedRows,
      warnings: parsed.warnings,
    },
  });

  revalidatePath("/service");
  revalidatePath("/admin/service-pricing");
  revalidatePath("/admin/activity");
}

export async function updateServiceRequestStatusAction(formData: FormData) {
  await requirePermission("service", "write");
  const requestId = String(formData.get("requestId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!requestId || !serviceRequestStatuses.has(status)) {
    throw new Error("Service request status update is invalid.");
  }

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { status },
  });

  await logAdminActivity({
    entityType: "service-request",
    entityId: requestId,
    action: "service.request.status.updated",
    summary: `Статус сервисной заявки изменен на ${status}.`,
    metadata: { status },
  });

  revalidatePath("/admin/service-pricing");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
}