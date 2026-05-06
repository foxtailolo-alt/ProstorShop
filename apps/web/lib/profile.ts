import { prisma } from "@prostor/db";
import { getSession } from "./auth/session";
import { listCatalogProducts, loadCategoryTree } from "./data/catalog";
import { getUserReferralPromoCode } from "./promo";
import { buildUpgradeSuggestions, extractStorageLabel, inferDeviceFamilyFromProductText, normalizeText } from "./upgrade-suggestions";

type PendingPurchasedDeviceSourceOrder = {
  id: string;
  orderNumber: string | null;
  status: string;
  createdAt: Date;
  items: Array<{
    id: string;
    variantLabel: string | null;
    product: {
      name: string;
      brand: string;
      imageUrl: string | null;
    } | null;
  }>;
};

type PendingPurchasedDeviceSourceUserDevice = {
  orderId: string | null;
  model: string;
};

function buildPendingPurchasedDevices(
  orders: PendingPurchasedDeviceSourceOrder[],
  userDevices: PendingPurchasedDeviceSourceUserDevice[],
) {
  const linkedOrderIds = new Set(
    userDevices
      .map((device) => device.orderId)
      .filter((orderId): orderId is string => Boolean(orderId)),
  );

  return orders.flatMap((order) => {
    if (order.status !== "completed") {
      return [];
    }

    return order.items.flatMap((item) => {
      const product = item.product;
      if (!product) {
        return [];
      }

      const categoryCode = inferDeviceFamilyFromProductText(product.name, product.brand);
      if (!categoryCode) {
        return [];
      }

      if (linkedOrderIds.has(order.id)) {
        return [];
      }

      return [{
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderCreatedAt: order.createdAt,
        orderItemId: item.id,
        categoryCode,
        brand: product.brand,
        model: product.name,
        storage: extractStorageLabel(item.variantLabel) ?? extractStorageLabel(product.name),
        imageUrl: product.imageUrl,
      }];
    });
  });
}

export async function getCurrentUserProfile() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const [user, referralPromoCode, catalogProducts, categoryTree] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        roleAssignments: {
          include: { role: true },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                  },
                },
              },
            },
            appliedPromoCode: {
              select: {
                code: true,
              },
            },
          },
        },
        userDevices: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          include: {
            accessories: true,
            tradeInBonus: {
              include: {
                promoCode: true,
              },
            },
          },
        },
        usedDeviceWaitlistEntries: {
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        },
        profileNotifications: {
          where: {
            isViewed: false,
          },
          orderBy: { createdAt: "desc" },
          include: {
            product: {
              include: {
                category: true,
              },
            },
            waitlistEntry: true,
          },
          take: 5,
        },
      },
    }),
    getUserReferralPromoCode(session.user.id),
    listCatalogProducts(),
    loadCategoryTree(),
  ]);

  if (!user) {
    return null;
  }

  const pendingPurchasedDevices = buildPendingPurchasedDevices(user.orders, user.userDevices);

  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    loyaltyPoints: user.loyaltyPoints,
    roles: user.roleAssignments.map((assignment) => assignment.role.code),
    referralPromoCode,
    userDevices: user.userDevices.map((device) => ({
      id: device.id,
      sourceKind: device.sourceKind,
      nickname: device.nickname,
      imageUrl: device.imageUrl,
      categoryCode: device.categoryCode,
      brand: device.brand,
      model: device.model,
      deviceModelCode: device.deviceModelCode,
      storage: device.storage,
      condition: device.condition,
      estimatedTradeInValue: Number(device.estimatedTradeInValue),
      lastTradeInSnapshotVersion: device.lastTradeInSnapshotVersion,
      answersJson:
        device.answersJson && typeof device.answersJson === "object" && !Array.isArray(device.answersJson)
          ? (device.answersJson as Record<string, unknown>)
          : {},
      tradeInRequestId: device.tradeInRequestId,
      orderId: device.orderId,
      accessories: device.accessories.map((accessory) => ({
        id: accessory.id,
        kind: accessory.kind,
        sourceKind: accessory.sourceKind,
        productName: accessory.productName,
        imageUrl: accessory.imageUrl,
      })),
      tradeInBonus: device.tradeInBonus
        ? {
            amount: Number(device.tradeInBonus.amount),
            promoCode: device.tradeInBonus.promoCode.code,
            promoCodeId: device.tradeInBonus.promoCodeId,
          }
        : null,
      upgradeSuggestions: buildUpgradeSuggestions(
        {
          categoryCode: device.categoryCode,
          brand: device.brand,
          model: device.model,
          storage: device.storage,
          estimatedTradeInValue: Number(device.estimatedTradeInValue),
        },
        catalogProducts,
        categoryTree,
      ),
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    })),
    usedDeviceWaitlistEntries: user.usedDeviceWaitlistEntries.map((entry) => ({
      id: entry.id,
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
      status: entry.status,
      fulfilledByOrderId: entry.fulfilledByOrderId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    })),
    profileNotifications: user.profileNotifications.map((notification) => ({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      isViewed: notification.isViewed,
      createdAt: notification.createdAt,
      product: notification.product
        ? {
            slug: notification.product.slug,
            name: notification.product.name,
            categorySlug: notification.product.category.slug,
            price: Number(notification.product.price),
          }
        : null,
      waitlistEntry: notification.waitlistEntry
        ? {
            id: notification.waitlistEntry.id,
            model: notification.waitlistEntry.model,
            storage: notification.waitlistEntry.storage,
            color: notification.waitlistEntry.color,
          }
        : null,
    })),
    pendingPurchasedDevices,
    orders: user.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      cashbackPointsAwarded: order.cashbackPointsAwarded,
      customerName: order.customerName,
      phone: order.phone,
      promoCode: order.appliedPromoCode?.code ?? null,
      promoRewardDescription: order.promoRewardDescription,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        name: item.product?.name ?? "Удалённый товар",
        quantity: item.quantity,
        price: Number(item.price),
        variantLabel: item.variantLabel,
        slug: item.product?.slug ?? null,
        categorySlug: item.product?.category.slug ?? null,
        imageUrl: item.product?.imageUrl ?? null,
        canAddToDevices: pendingPurchasedDevices.some((entry) => entry.orderItemId === item.id),
      })),
    })),
  };
}