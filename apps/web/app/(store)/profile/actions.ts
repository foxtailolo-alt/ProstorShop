"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getSession } from "../../../lib/auth/session";
import { extractStorageLabel, inferDeviceFamilyFromProductText, normalizeText } from "../../../lib/upgrade-suggestions";

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

  const existingDevice = await prisma.userDevice.findFirst({
    where: {
      userId: session.user.id,
      orderId: order.id,
      model: product.name,
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