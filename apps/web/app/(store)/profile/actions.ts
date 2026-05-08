"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getSession } from "../../../lib/auth/session";
import { getActiveTradeInSnapshot } from "../../../lib/data/pricing";
import { getTradeInModels, type TradeInSnapshotGraph } from "../../../lib/trade-in-snapshot";
import { extractStorageLabel, inferDeviceFamilyFromProductText, normalizeText } from "../../../lib/upgrade-suggestions";

function inferTradeInModelCodeFromSources(
  snapshot: TradeInSnapshotGraph | null,
  categoryCode: string,
  ...sources: Array<string | null | undefined>
) {
  if (!snapshot) {
    return null;
  }

  const models = getTradeInModels(snapshot, categoryCode);
  const normalizedSource = ` ${normalizeText(sources.filter(Boolean).join(" "))} `;
  const matched = models
    .slice()
    .sort((left, right) => right.title.length - left.title.length)
    .find((candidate) => normalizedSource.includes(` ${normalizeText(candidate.title)} `));

  return matched?.code ?? null;
}

export async function addProfileDeviceAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    throw new Error("Авторизуйтесь, чтобы сохранить устройство в профиль.");
  }

  const nickname = String(formData.get("nickname") ?? "").trim() || null;
  const deviceId = String(formData.get("deviceId") ?? "").trim() || null;
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const condition = String(formData.get("condition") ?? "").trim();
  const snapshotVersion = Number(formData.get("snapshotVersion") ?? 0) || null;
  const categoryCode = String(formData.get("categoryCode") ?? "").trim();
  const deviceModelCode = String(formData.get("deviceModelCode") ?? "").trim() || null;
  const answersJsonValue = String(formData.get("answersJson") ?? "").trim();
  const quote = Number(formData.get("quote") ?? 0);

  let answersJson: Record<string, string> | null = null;
  if (answersJsonValue) {
    try {
      const parsed = JSON.parse(answersJsonValue) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        answersJson = Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === "string"),
        );
      }
    } catch {
      answersJson = null;
    }
  }

  if (!brand || !model || !condition || !categoryCode || !Number.isFinite(quote) || quote < 0) {
    throw new Error("Форма устройства заполнена не полностью.");
  }

  const existingDevice = deviceId
    ? await prisma.userDevice.findFirst({
        where: {
          id: deviceId,
          userId: session.user.id,
        },
      })
    : null;

  if (deviceId && !existingDevice) {
    throw new Error("Устройство для переоценки не найдено.");
  }

  if (existingDevice) {
    const isPurchasedDevice = existingDevice.sourceKind === "purchase";

    await prisma.userDevice.update({
      where: { id: existingDevice.id },
      data: {
        nickname: nickname ?? existingDevice.nickname,
        categoryCode,
        brand,
        model,
        deviceModelCode,
        storage,
        condition: isPurchasedDevice ? existingDevice.condition : condition,
        estimatedTradeInValue: quote,
        lastTradeInSnapshotVersion: snapshotVersion,
        answersJson: answersJson ?? undefined,
        imageUrl: existingDevice.imageUrl,
        sourceKind: existingDevice.sourceKind,
        orderId: existingDevice.orderId,
      },
    });

    if (isPurchasedDevice) {
      const normalizedUpdatedModel = normalizeText(model);
      const duplicateFilters = [
        deviceModelCode ? { deviceModelCode } : null,
        {
          model: {
            contains: normalizedUpdatedModel,
            mode: "insensitive" as const,
          },
        },
      ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      await prisma.userDevice.deleteMany({
        where: {
          userId: session.user.id,
          id: {
            not: existingDevice.id,
          },
          orderId: null,
          tradeInRequestId: null,
          sourceKind: "manual",
          categoryCode,
          OR: duplicateFilters,
        },
      });
    }
  } else {
    await prisma.userDevice.create({
      data: {
        userId: session.user.id,
        sourceKind: "manual",
        nickname,
        categoryCode,
        brand,
        model,
        deviceModelCode,
        storage,
        condition,
        estimatedTradeInValue: quote,
        lastTradeInSnapshotVersion: snapshotVersion,
        answersJson: answersJson ?? undefined,
      },
    });
  }

  revalidatePath("/profile");
  redirect("/profile?tab=devices&deviceAdded=1");
}

export async function addPurchasedProfileDeviceAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    throw new Error("Авторизуйтесь, чтобы сохранить устройство в профиль.");
  }

  const orderId = String(formData.get("orderId") ?? "").trim();
  const orderItemId = String(formData.get("orderItemId") ?? "").trim();

  if (!orderId || !orderItemId) {
    throw new Error("Не удалось определить товар из заказа.");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: session.user.id,
      status: "completed",
    },
    include: {
      items: {
        where: { id: orderItemId },
        include: {
          product: true,
        },
        take: 1,
      },
    },
  });

  const item = order?.items[0];
  const product = item?.product;

  if (!order || !item || !product) {
    throw new Error("Товар заказа не найден или ещё не готов к добавлению.");
  }

  const categoryCode = inferDeviceFamilyFromProductText(product.name, product.brand);
  if (!categoryCode) {
    throw new Error("Этот товар нельзя автоматически предложить в разделе устройств.");
  }
  const tradeInSnapshot = await getActiveTradeInSnapshot();
  const deviceModelCode = inferTradeInModelCodeFromSources(tradeInSnapshot, categoryCode, product.name, item.variantLabel);

  const existingDevice = await prisma.userDevice.findFirst({
    where: {
      userId: session.user.id,
      OR: [
        {
          orderId: order.id,
          model: product.name,
        },
        {
          categoryCode,
          model: product.name,
        },
        ...(deviceModelCode
          ? [{
              deviceModelCode,
            }]
          : []),
      ],
    },
    select: { id: true },
  });

  if (!existingDevice) {
    await prisma.userDevice.create({
      data: {
        userId: session.user.id,
        sourceKind: "purchase",
        imageUrl: product.imageUrl,
        categoryCode,
        brand: product.brand,
        model: product.name,
        deviceModelCode,
        storage: extractStorageLabel(item.variantLabel) ?? extractStorageLabel(product.name),
        condition: "Куплено в Просторе",
        estimatedTradeInValue: 0,
        orderId: order.id,
      },
    });
  }

  revalidatePath("/profile");
  redirect("/profile?tab=devices&deviceAdded=1");
}

export async function removeProfileDeviceAction(formData: FormData) {
  const session = await getSession();

  if (!session) {
    throw new Error("Авторизуйтесь, чтобы удалить устройство.");
  }

  const deviceId = String(formData.get("deviceId") ?? "").trim();

  if (!deviceId) {
    throw new Error("Не удалось определить устройство для удаления.");
  }

  const device = await prisma.userDevice.findFirst({
    where: {
      id: deviceId,
      userId: session.user.id,
    },
    select: { id: true },
  });

  if (!device) {
    throw new Error("Устройство не найдено в вашем профиле.");
  }

  await prisma.userDevice.delete({ where: { id: device.id } });

  revalidatePath("/profile");
  redirect("/profile?tab=devices&deviceRemoved=1");
}

export async function attachAccessoryActionFromProfile(formData: FormData) {
  const { attachAccessoryToDevice, getSupportedAccessoriesForCategory } = await import(
    "../../../lib/device-accessories"
  );

  const session = await getSession();
  if (!session) {
    throw new Error("Авторизуйтесь, чтобы добавить аксессуар.");
  }

  const userDeviceId = String(formData.get("userDeviceId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim() as "case" | "glass";
  const orderItemId = String(formData.get("orderItemId") ?? "").trim() || null;
  const productId = String(formData.get("productId") ?? "").trim() || null;
  const productName = String(formData.get("productName") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const notificationId = String(formData.get("notificationId") ?? "").trim();

  if (!userDeviceId || !kind) {
    throw new Error("Не указано устройство или тип аксессуара.");
  }

  const device = await prisma.userDevice.findFirst({
    where: { id: userDeviceId, userId: session.user.id },
    select: { id: true, categoryCode: true },
  });

  if (!device) {
    throw new Error("Устройство не найдено в вашем профиле.");
  }

  if (!getSupportedAccessoriesForCategory(device.categoryCode).includes(kind)) {
    throw new Error("Для этого устройства такой аксессуар не поддерживается.");
  }

  await attachAccessoryToDevice({
    userDeviceId: device.id,
    kind,
    sourceKind: orderItemId ? "purchase" : "manual",
    orderItemId,
    productId,
    productName,
    imageUrl,
  });

  if (notificationId) {
    await prisma.profileNotification.updateMany({
      where: { id: notificationId, userId: session.user.id },
      data: { isViewed: true, viewedAt: new Date() },
    });
  }

  revalidatePath("/profile");
}

export async function removeAccessoryActionFromProfile(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Авторизуйтесь, чтобы изменить аксессуары.");
  }

  const accessoryId = String(formData.get("accessoryId") ?? "").trim();
  if (!accessoryId) throw new Error("Не указан аксессуар.");

  const accessory = await prisma.userDeviceAccessory.findFirst({
    where: {
      id: accessoryId,
      userDevice: { userId: session.user.id },
    },
    select: { id: true },
  });

  if (!accessory) throw new Error("Аксессуар не найден.");

  await prisma.userDeviceAccessory.delete({ where: { id: accessoryId } });
  revalidatePath("/profile");
}