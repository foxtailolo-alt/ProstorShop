"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { buildTelegramPostText } from "../../../../lib/telegram-post-template";
import { buildMiniAppProductUrl, sendTelegramPost } from "../../../../lib/telegram";

export async function publishTelegramPostAction(formData: FormData) {
  await requirePermission("telegram-posts", "write");
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const ctaText = String(formData.get("ctaText") ?? "").trim() || "Открыть в Mini App";

  if (!productSlug || !title || !description) {
    throw new Error("Telegram post form is incomplete.");
  }

  const product = await prisma.product.findUnique({ where: { slug: productSlug } });

  if (!product) {
    throw new Error("Product not found.");
  }

  const buttonUrl = buildMiniAppProductUrl(product.slug);
  const priceText = `${Number(product.price).toLocaleString("ru-RU")} ₽`;
  const text = buildTelegramPostText({ title, description, priceText });

  try {
    await sendTelegramPost({ text, buttonText: ctaText, buttonUrl, imageUrl: product.imageUrl });
  } catch {
    throw new Error("Не удалось опубликовать пост в Telegram. Проверьте настройки бота и доступ к каналу.");
  }

  const post = await prisma.telegramPost.create({
    data: {
      productId: product.id,
      title,
      description,
      deepLink: buttonUrl,
      status: "posted",
    },
  });

  await logAdminActivity({
    entityType: "telegram-post",
    entityId: post.id,
    action: "telegram.post.published",
    summary: `Опубликован Telegram-пост для ${product.name}.`,
    metadata: {
      productSlug: product.slug,
      title,
      deepLink: buttonUrl,
    },
  });

  revalidatePath("/admin/telegram-posts");
  revalidatePath("/admin/activity");
}