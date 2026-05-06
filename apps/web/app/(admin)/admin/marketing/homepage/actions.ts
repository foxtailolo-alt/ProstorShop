"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../../lib/audit";
import { requirePermission } from "../../../../../lib/auth/session";

// --- Homepage Sections ---

export async function upsertSectionAction(formData: FormData) {
  await requirePermission("banners", "write");

  const sectionId = String(formData.get("sectionId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "custom").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? "0");
  const isActive = formData.get("isActive") === "on";

  if (!title) {
    throw new Error("Название секции обязательно.");
  }

  if (sectionId) {
    await prisma.homepageSection.update({
      where: { id: sectionId },
      data: { title, type, sortOrder, isActive },
    });

    await logAdminActivity({
      entityType: "homepage_section",
      entityId: sectionId,
      action: "update",
      summary: `Секция главной обновлена: ${title}`,
    });
  } else {
    const section = await prisma.homepageSection.create({
      data: { title, type, sortOrder, isActive },
    });

    await logAdminActivity({
      entityType: "homepage_section",
      entityId: section.id,
      action: "create",
      summary: `Секция главной создана: ${title}`,
    });
  }

  revalidatePath("/admin/marketing/homepage");
  revalidatePath("/");
}

export async function deleteSectionAction(formData: FormData) {
  await requirePermission("banners", "delete");

  const sectionId = String(formData.get("sectionId") ?? "").trim();
  if (!sectionId) return;

  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId } });
  if (!section) return;

  await prisma.homepageSection.delete({ where: { id: sectionId } });

  await logAdminActivity({
    entityType: "homepage_section",
    entityId: sectionId,
    action: "delete",
    summary: `Секция главной удалена: ${section.title}`,
  });

  revalidatePath("/admin/marketing/homepage");
  revalidatePath("/");
}

export async function addItemToSectionAction(formData: FormData) {
  await requirePermission("banners", "write");

  const sectionId = String(formData.get("sectionId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const isHighlighted = formData.get("isHighlighted") === "on";

  if (!sectionId || !productId) return;

  const maxPosition = await prisma.homepageItem.aggregate({
    where: { sectionId },
    _max: { position: true },
  });

  await prisma.homepageItem.create({
    data: {
      sectionId,
      productId,
      position: (maxPosition._max.position ?? -1) + 1,
      isHighlighted,
    },
  });

  revalidatePath("/admin/marketing/homepage");
  revalidatePath("/");
}

export async function removeItemFromSectionAction(formData: FormData) {
  await requirePermission("banners", "write");

  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return;

  await prisma.homepageItem.delete({ where: { id: itemId } });

  revalidatePath("/admin/marketing/homepage");
  revalidatePath("/");
}

export async function toggleItemHighlightAction(formData: FormData) {
  await requirePermission("banners", "write");

  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return;

  const item = await prisma.homepageItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  await prisma.homepageItem.update({
    where: { id: itemId },
    data: { isHighlighted: !item.isHighlighted },
  });

  revalidatePath("/admin/marketing/homepage");
  revalidatePath("/");
}

export async function reorderItemAction(formData: FormData) {
  await requirePermission("banners", "write");

  const itemId = String(formData.get("itemId") ?? "").trim();
  const direction = String(formData.get("direction") ?? "").trim();
  if (!itemId || !["up", "down"].includes(direction)) return;

  const item = await prisma.homepageItem.findUnique({ where: { id: itemId } });
  if (!item) return;

  const siblings = await prisma.homepageItem.findMany({
    where: { sectionId: item.sectionId },
    orderBy: { position: "asc" },
  });

  const idx = siblings.findIndex((s) => s.id === itemId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;

  const swapItem = siblings[swapIdx]!;

  await prisma.$transaction([
    prisma.homepageItem.update({ where: { id: item.id }, data: { position: swapItem.position } }),
    prisma.homepageItem.update({ where: { id: swapItem.id }, data: { position: item.position } }),
  ]);

  revalidatePath("/admin/marketing/homepage");
  revalidatePath("/");
}
