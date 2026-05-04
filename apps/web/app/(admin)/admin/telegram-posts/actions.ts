"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@prostor/db";
import { logAdminActivity } from "../../../../lib/audit";
import { requirePermission } from "../../../../lib/auth/session";
import { buildTelegramPostText } from "../../../../lib/telegram-post-template";
import { buildMiniAppProductUrl, sendTelegramPost } from "../../../../lib/telegram";
import { buildPriceText, formatProductPrice, resolveProductPrice, roundProductPrice } from "../../../../lib/pricing";

function buildProductPaths(categorySlug: string, productSlug: string) {
  return [
    "/",
    "/catalog",
    "/mini-app",
    "/admin/products",
    "/admin/telegram-posts",
    `/catalog/${categorySlug}`,
    `/catalog/${categorySlug}/${productSlug}`,
  ];
}

function revalidateProductPaths(categorySlug: string, productSlug: string) {
  for (const path of buildProductPaths(categorySlug, productSlug)) {
    revalidatePath(path);
  }
}

export async function publishTelegramPostAction(formData: FormData) {
  await requirePermission("telegram-posts", "write");
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const ctaText = String(formData.get("ctaText") ?? "").trim() || "Открыть в Mini App";

  if (!productSlug || !title || !description) {
    throw new Error("Telegram post form is incomplete.");
  }

  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    include: {
      category: {
        select: { slug: true },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found.");
  }

  const buttonUrl = buildMiniAppProductUrl(product.slug);
  const resolvedPrice = resolveProductPrice({
    basePrice: Number(product.price),
    discountType: product.discountType,
    discountValue: product.discountValue ? Number(product.discountValue) : null,
    discountStartsAt: product.discountStartsAt,
    discountEndsAt: product.discountEndsAt,
  });
  const priceText = buildPriceText(resolvedPrice.price, resolvedPrice.compareAtPrice);
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

export async function applyTelegramProductDiscountAction(formData: FormData) {
  await requirePermission("products", "write");
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const discountType = String(formData.get("discountType") ?? "").trim();
  const discountValueRaw = Number(formData.get("discountValue") ?? Number.NaN);
  const durationMode = String(formData.get("discountDurationMode") ?? "forever").trim();
  const discountEndsAtRaw = String(formData.get("discountEndsAt") ?? "").trim();

  if (!productSlug) {
    throw new Error("Не выбран товар для скидки.");
  }

  if (!["percent", "fixed"].includes(discountType)) {
    throw new Error("Выберите тип скидки.");
  }

  if (!Number.isFinite(discountValueRaw) || discountValueRaw <= 0) {
    throw new Error("Укажите корректное значение скидки.");
  }

  if (discountType === "percent" && discountValueRaw >= 100) {
    throw new Error("Скидка в процентах должна быть меньше 100.");
  }

  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    include: {
      category: {
        select: { slug: true },
      },
    },
  });

  if (!product) {
    throw new Error("Товар не найден.");
  }

  let discountEndsAt: Date | null = null;
  if (durationMode === "until-date") {
    if (!discountEndsAtRaw) {
      throw new Error("Укажите дату окончания скидки.");
    }

    discountEndsAt = new Date(discountEndsAtRaw);
    if (Number.isNaN(discountEndsAt.getTime()) || discountEndsAt.getTime() <= Date.now()) {
      throw new Error("Дата окончания скидки должна быть в будущем.");
    }
  }

  const nextDiscountValue = roundProductPrice(discountValueRaw);

  await prisma.product.update({
    where: { id: product.id },
    data: {
      discountType,
      discountValue: nextDiscountValue,
      discountStartsAt: new Date(),
      discountEndsAt,
    },
  });

  const resolvedPrice = resolveProductPrice({
    basePrice: Number(product.price),
    discountType,
    discountValue: nextDiscountValue,
    discountEndsAt,
  });

  await logAdminActivity({
    entityType: "product",
    entityId: product.id,
    action: "product.discount.updated",
    summary: `Для ${product.name} применена скидка: ${formatProductPrice(resolvedPrice.price)} вместо ${formatProductPrice(Number(product.price))}.`,
    metadata: {
      productSlug,
      discountType,
      discountValue: nextDiscountValue,
      discountEndsAt: discountEndsAt?.toISOString() ?? null,
    },
  });

  revalidateProductPaths(product.category.slug, product.slug);
  revalidatePath("/admin/activity");
}

export async function clearTelegramProductDiscountAction(formData: FormData) {
  await requirePermission("products", "write");
  const productSlug = String(formData.get("productSlug") ?? "").trim();

  if (!productSlug) {
    throw new Error("Не выбран товар для снятия скидки.");
  }

  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    include: {
      category: {
        select: { slug: true },
      },
    },
  });

  if (!product) {
    throw new Error("Товар не найден.");
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      discountType: null,
      discountValue: null,
      discountStartsAt: null,
      discountEndsAt: null,
    },
  });

  await logAdminActivity({
    entityType: "product",
    entityId: product.id,
    action: "product.discount.cleared",
    summary: `Для ${product.name} снята скидка.`,
    metadata: {
      productSlug,
    },
  });

  revalidateProductPaths(product.category.slug, product.slug);
  revalidatePath("/admin/activity");
}