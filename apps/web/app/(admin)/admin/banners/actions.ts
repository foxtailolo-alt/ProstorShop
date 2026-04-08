"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { saveBannerImage } from "../../../../lib/media";

const maxActiveBanners = 5;

export async function upsertBannerAction(formData: FormData) {
  await requirePermission("banners", "write");
  const bannerId = String(formData.get("bannerId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const imageFile = formData.get("imageFile") as File | null;
  const existingImageUrl = String(formData.get("existingImageUrl") ?? "").trim();

  if (!linkUrl) {
    throw new Error("Ссылка обязательна.");
  }

  let imageUrl = existingImageUrl;

  if (imageFile && imageFile.size > 0) {
    const uploaded = await saveBannerImage(imageFile);
    if (uploaded) {
      imageUrl = uploaded;
    }
  }

  if (!imageUrl) {
    throw new Error("Изображение обязательно.");
  }

  if (isActive) {
    const activeCount = await prisma.banner.count({
      where: {
        isActive: true,
        ...(bannerId ? { id: { not: bannerId } } : {}),
      },
    });

    if (activeCount >= maxActiveBanners) {
      throw new Error(`Максимум ${maxActiveBanners} активных баннеров.`);
    }
  }

  if (bannerId) {
    await prisma.banner.update({
      where: { id: bannerId },
      data: { title, imageUrl, linkUrl, sortOrder, isActive },
    });

    await logAdminActivity({
      entityType: "banner",
      entityId: bannerId,
      action: "update",
      summary: `Баннер обновлён: ${title ?? linkUrl}`,
    });
  } else {
    const banner = await prisma.banner.create({
      data: { title, imageUrl, linkUrl, sortOrder, isActive },
    });

    await logAdminActivity({
      entityType: "banner",
      entityId: banner.id,
      action: "create",
      summary: `Баннер создан: ${title ?? linkUrl}`,
    });
  }

  revalidatePath("/admin/banners");
  revalidatePath("/");
}

export async function deleteBannerAction(formData: FormData) {
  await requirePermission("banners", "delete");
  const bannerId = String(formData.get("bannerId") ?? "").trim();

  if (!bannerId) {
    throw new Error("Banner ID is required.");
  }

  const banner = await prisma.banner.findUnique({ where: { id: bannerId } });

  if (!banner) {
    throw new Error("Баннер не найден.");
  }

  await prisma.banner.delete({ where: { id: bannerId } });

  await logAdminActivity({
    entityType: "banner",
    entityId: bannerId,
    action: "delete",
    summary: `Баннер удалён: ${banner.title ?? banner.linkUrl}`,
  });

  revalidatePath("/admin/banners");
  revalidatePath("/");
}

export async function toggleBannerActiveAction(formData: FormData) {
  await requirePermission("banners", "write");
  const bannerId = String(formData.get("bannerId") ?? "").trim();

  if (!bannerId) {
    throw new Error("Banner ID is required.");
  }

  const banner = await prisma.banner.findUnique({ where: { id: bannerId } });

  if (!banner) {
    throw new Error("Баннер не найден.");
  }

  const newActive = !banner.isActive;

  if (newActive) {
    const activeCount = await prisma.banner.count({
      where: { isActive: true, id: { not: bannerId } },
    });

    if (activeCount >= maxActiveBanners) {
      throw new Error(`Максимум ${maxActiveBanners} активных баннеров.`);
    }
  }

  await prisma.banner.update({
    where: { id: bannerId },
    data: { isActive: newActive },
  });

  revalidatePath("/admin/banners");
  revalidatePath("/");
}
