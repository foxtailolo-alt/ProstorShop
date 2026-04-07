"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import * as XLSX from "xlsx";
import { logAdminActivity } from "../../../../lib/audit";

const serviceRequestStatuses = new Set(["new", "contacted", "accepted", "completed", "cancelled"]);

type ParsedServiceRow = {
  brand: string;
  model: string;
  repairType: string;
  price: number;
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function parseRows(buffer: Buffer, fileName: string) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Пустой файл прайса.");
  }

  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    throw new Error("Пустой файл прайса.");
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const parsedRows = rows
    .map<ParsedServiceRow | null>((row) => {
      const normalizedEntries = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [normalizeKey(key), String(value).trim()]),
      );

      const brand = normalizedEntries.brand || normalizedEntries["бренд"];
      const model = normalizedEntries.model || normalizedEntries["модель"];
      const repairType = normalizedEntries.repairtype || normalizedEntries["repair type"] || normalizedEntries["ремонт"] || normalizedEntries["тип ремонта"];
      const priceValue = normalizedEntries.price || normalizedEntries["цена"];
      const price = Number(String(priceValue).replace(/\s/g, "").replace(",", "."));

      if (!brand || !model || !repairType || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      return { brand, model, repairType, price };
    })
    .filter((row): row is ParsedServiceRow => Boolean(row));

  if (parsedRows.length === 0) {
    throw new Error(`Не удалось разобрать строки в ${fileName}. Нужны колонки brand/model/repairType/price.`);
  }

  return parsedRows;
}

export async function importServicePricingAction(formData: FormData) {
  const file = formData.get("priceFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Файл прайса не выбран.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseRows(buffer, file.name);
  const latestTable = await prisma.servicePriceTable.findFirst({
    orderBy: { version: "desc" },
  });

  const nextVersion = (latestTable?.version ?? 0) + 1;

  await prisma.$transaction(async (transaction) => {
    await transaction.servicePriceTable.updateMany({
      data: { isActive: false },
    });

    const table = await transaction.servicePriceTable.create({
      data: {
        version: nextVersion,
        sourceFile: file.name,
        isActive: true,
      },
    });

    await transaction.servicePriceRow.createMany({
      data: parsedRows.map((row) => ({
        tableId: table.id,
        brand: row.brand,
        model: row.model,
        repairType: row.repairType,
        price: row.price,
      })),
    });
  });

  await logAdminActivity({
    entityType: "service-price-table",
    action: "service.pricing.imported",
    summary: `Импортирован прайс ${file.name} с ${parsedRows.length} строками.`,
    metadata: {
      fileName: file.name,
      rows: parsedRows.length,
      version: nextVersion,
    },
  });

  revalidatePath("/service");
  revalidatePath("/admin/service-pricing");
  revalidatePath("/admin/activity");
}

export async function updateServiceRequestStatusAction(formData: FormData) {
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