import { prisma } from "@prostor/db";
import { findCatalogProductBySlug } from "./data/catalog";
import { buildMiniAppProductUrl, sendTelegramDirectMessage } from "./telegram";
import { matchUsedDeviceWaitlistEntryToProduct } from "./used-device-waitlist";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
}

function buildCatalogProductUrl(categorySlug: string, productSlug: string) {
  return new URL(`/catalog/${categorySlug}/${productSlug}`, getSiteUrl()).toString();
}

function buildWaitlistProductUrl(categorySlug: string, productSlug: string) {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim();
  const shortName = process.env.TELEGRAM_MINI_APP_SHORT_NAME?.trim();

  if (botUsername && shortName) {
    return buildMiniAppProductUrl(productSlug);
  }

  return buildCatalogProductUrl(categorySlug, productSlug);
}

function formatPrice(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function buildWaitlistTitle(input: { model: string; storage: string | null; color: string | null }) {
  return [input.model, input.storage, input.color].filter(Boolean).join(" • ");
}

export async function processUsedDeviceWaitlistMatchesForProduct(productId: string) {
  const dbProduct = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: {
        select: { slug: true },
      },
      attributes: {
        include: { definition: true },
      },
    },
  });

  if (!dbProduct || !dbProduct.inStock || !dbProduct.category.slug) {
    return { matched: 0, notified: 0, skipped: 0 };
  }

  const catalogProduct = await findCatalogProductBySlug(dbProduct.slug);
  if (!catalogProduct || !catalogProduct.inStock) {
    return { matched: 0, notified: 0, skipped: 0 };
  }

  const entries = await prisma.usedDeviceWaitlistEntry.findMany({
    where: {
      status: {
        in: ["active", "matched"],
      },
    },
    include: {
      user: {
        select: {
          telegramId: true,
        },
      },
      matches: {
        where: {
          productId,
        },
        take: 1,
      },
    },
  });

  let matched = 0;
  let notified = 0;
  let skipped = 0;

  for (const entry of entries) {
    const match = matchUsedDeviceWaitlistEntryToProduct(
      {
        categoryCode: entry.categoryCode,
        brand: entry.brand,
        model: entry.model,
        deviceModelCode: entry.deviceModelCode,
        normalizedModel: entry.normalizedModel,
        modelRank: entry.modelRank,
        storage: entry.storage,
        color: entry.color,
        displaySize: entry.displaySize,
        connectivity: entry.connectivity,
      },
      catalogProduct,
    );

    if (!match.isMatch || !match.breakdown) {
      skipped += 1;
      continue;
    }

    matched += 1;
    const existingMatch = entry.matches[0] ?? null;

    await prisma.usedDeviceWaitlistMatch.upsert({
      where: {
        waitlistEntryId_productId: {
          waitlistEntryId: entry.id,
          productId,
        },
      },
      update: {
        confidence: match.confidence,
        matchSource: match.matchSource,
        breakdownJson: match.breakdown,
      },
      create: {
        waitlistEntryId: entry.id,
        productId,
        confidence: match.confidence,
        matchSource: match.matchSource,
        breakdownJson: match.breakdown,
      },
    });

    if (entry.status === "active") {
      await prisma.usedDeviceWaitlistEntry.update({
        where: { id: entry.id },
        data: { status: "matched" },
      });
    }

    const existingNotification = await prisma.profileNotification.findFirst({
      where: {
        userId: entry.userId,
        kind: "waitlist_match",
        waitlistEntryId: entry.id,
        productId,
      },
      select: { id: true },
    });

    if (!existingNotification) {
      await prisma.profileNotification.create({
        data: {
          userId: entry.userId,
          waitlistEntryId: entry.id,
          productId,
          kind: "waitlist_match",
          title: "Есть подходящий вариант по вашему запросу",
          body: `${buildWaitlistTitle({ model: entry.model, storage: entry.storage, color: entry.color })} → ${catalogProduct.name}`,
          actionUrl: `/catalog/${catalogProduct.categorySlug}/${catalogProduct.slug}`,
        },
      });
    }

    if (existingMatch?.notifiedAt || !entry.user.telegramId || !process.env.TELEGRAM_BOT_TOKEN) {
      continue;
    }

    try {
      const messageId = await sendTelegramDirectMessage({
        chatId: entry.user.telegramId,
        text: [
          `<b>Появился подходящий Trade-in вариант</b>`,
          `${buildWaitlistTitle({ model: entry.model, storage: entry.storage, color: entry.color })}`,
          `${catalogProduct.name}`,
          `Цена: ${formatPrice(catalogProduct.price)}`,
        ].join("\n"),
        buttonText: "Открыть товар",
        buttonUrl: buildWaitlistProductUrl(catalogProduct.categorySlug, catalogProduct.slug),
        imageUrl: catalogProduct.imageUrl,
      });

      await prisma.usedDeviceWaitlistMatch.update({
        where: {
          waitlistEntryId_productId: {
            waitlistEntryId: entry.id,
            productId,
          },
        },
        data: {
          telegramMessageId: messageId,
          notifiedAt: new Date(),
        },
      });

      notified += 1;
    } catch {
      skipped += 1;
    }
  }

  return { matched, notified, skipped };
}

export async function fulfillUsedDeviceWaitlistEntriesForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    return { fulfilled: 0, checkedProducts: 0 };
  }

  const products = await Promise.all(
    order.items
      .map((item) => item.product)
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .map((product) => findCatalogProductBySlug(product.slug)),
  );

  const catalogProducts = products.filter((product): product is NonNullable<typeof product> => Boolean(product));
  if (catalogProducts.length === 0) {
    return { fulfilled: 0, checkedProducts: 0 };
  }

  const entries = await prisma.usedDeviceWaitlistEntry.findMany({
    where: {
      status: {
        in: ["active", "matched"],
      },
      fulfilledByOrderId: null,
    },
  });

  let fulfilled = 0;

  for (const entry of entries) {
    const matchedProduct = catalogProducts.find((product) =>
      matchUsedDeviceWaitlistEntryToProduct(
        {
          categoryCode: entry.categoryCode,
          brand: entry.brand,
          model: entry.model,
          deviceModelCode: entry.deviceModelCode,
          normalizedModel: entry.normalizedModel,
          modelRank: entry.modelRank,
          storage: entry.storage,
          color: entry.color,
          displaySize: entry.displaySize,
          connectivity: entry.connectivity,
        },
        product,
      ).isMatch,
    );

    if (!matchedProduct) {
      continue;
    }

    await prisma.usedDeviceWaitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: "fulfilled",
        fulfilledByOrderId: orderId,
      },
    });

    fulfilled += 1;
  }

  return { fulfilled, checkedProducts: catalogProducts.length };
}