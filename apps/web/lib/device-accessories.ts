import { prisma } from "@prostor/db";
import { createUniquePromoCode } from "./promo";

export type AccessoryKind = "case" | "glass";

export const ACCESSORY_LABELS: Record<AccessoryKind, string> = {
  case: "Чехол",
  glass: "Защитное стекло",
};

const SLOT_ACCESSORY_MAP: Record<string, AccessoryKind[]> = {
  iphone: ["case", "glass"],
  samsung: ["case", "glass"],
  ipad: ["glass"],
  apple_watch: ["glass"],
};

const TRADE_IN_BONUS_MAP: Record<string, number> = {
  iphone: 5000,
  samsung: 5000,
  ipad: 3000,
  apple_watch: 2000,
};

export function getSupportedAccessoriesForCategory(categoryCode: string): AccessoryKind[] {
  return SLOT_ACCESSORY_MAP[categoryCode] ?? [];
}

export function getTradeInBonusAmountForCategory(categoryCode: string): number {
  return TRADE_IN_BONUS_MAP[categoryCode] ?? 0;
}

const KEYWORDS_BY_KIND: Record<AccessoryKind, RegExp[]> = {
  case: [/\bчехол\b/i, /\bкейс\b/i, /\bcase\b/i, /\bcover\b/i, /\bбампер\b/i],
  glass: [
    /защитн[а-я]*\s+стекл/i,
    /\bстекл/i,
    /\bглас{1,2}\b/i,
    /\bглас{1,2}\s+про/i,
    /screen\s*protector/i,
    /\btempered\b/i,
  ],
};

export function detectAccessoryKindFromText(...sources: Array<string | null | undefined>): AccessoryKind | null {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;

  for (const kind of Object.keys(KEYWORDS_BY_KIND) as AccessoryKind[]) {
    if (KEYWORDS_BY_KIND[kind].some((pattern) => pattern.test(text))) {
      return kind;
    }
  }
  return null;
}

const TARGET_KEYWORDS: Record<string, RegExp[]> = {
  iphone: [/iphone/i, /айфон/i],
  samsung: [/galaxy/i, /samsung/i, /самсунг/i],
  ipad: [/ipad/i, /айпад/i],
  apple_watch: [/apple\s*watch/i, /watch\s*ultra/i, /watch\s*series/i, /эпл\s*вотч/i],
};

export function detectAccessoryTargetCategory(...sources: Array<string | null | undefined>): string | null {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;
  for (const category of Object.keys(TARGET_KEYWORDS)) {
    const patterns = TARGET_KEYWORDS[category];
    if (patterns?.some((pattern) => pattern.test(text))) {
      return category;
    }
  }
  return null;
}

export async function attachAccessoryToDevice(input: {
  userDeviceId: string;
  kind: AccessoryKind;
  sourceKind?: string;
  orderItemId?: string | null;
  productId?: string | null;
  productName?: string | null;
  imageUrl?: string | null;
}) {
  await prisma.userDeviceAccessory.upsert({
    where: {
      userDeviceId_kind: {
        userDeviceId: input.userDeviceId,
        kind: input.kind,
      },
    },
    create: {
      userDeviceId: input.userDeviceId,
      kind: input.kind,
      sourceKind: input.sourceKind ?? "manual",
      orderItemId: input.orderItemId ?? null,
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      imageUrl: input.imageUrl ?? null,
    },
    update: {
      sourceKind: input.sourceKind ?? "manual",
      orderItemId: input.orderItemId ?? null,
      productId: input.productId ?? null,
      productName: input.productName ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });

  await maybeIssueTradeInBonus(input.userDeviceId);
}

export async function maybeIssueTradeInBonus(userDeviceId: string) {
  const device = await prisma.userDevice.findUnique({
    where: { id: userDeviceId },
    include: {
      accessories: true,
      tradeInBonus: true,
    },
  });

  if (!device || device.tradeInBonus) return null;

  const required = getSupportedAccessoriesForCategory(device.categoryCode);
  if (required.length === 0) return null;

  const haveAll = required.every((kind) => device.accessories.some((a) => a.kind === kind));
  if (!haveAll) return null;

  const amount = getTradeInBonusAmountForCategory(device.categoryCode);
  if (amount <= 0) return null;

  const code = await createUniquePromoCode("TRADEIN", 6);
  const promo = await prisma.promoCode.create({
    data: {
      code,
      type: "trade-in-bonus",
      scope: "trade-in",
      discountKind: "flat",
      discountValue: amount,
      ownerUserId: device.userId,
      rewardDescription: `Бонус +${amount.toLocaleString("ru-RU")} ₽ за полный комплект на ${device.model}`,
      isActive: true,
      usageLimit: 1,
      perUserLimit: 1,
    },
  });

  const bonus = await prisma.userDeviceTradeInBonus.create({
    data: {
      userDeviceId: device.id,
      promoCodeId: promo.id,
      amount,
    },
  });

  await prisma.profileNotification.create({
    data: {
      userId: device.userId,
      kind: "trade_in_bonus",
      title: `Промокод на +${amount.toLocaleString("ru-RU")} ₽ к Trade-in`,
      body: `Вы собрали полный комплект на ${device.model}. Используйте код ${promo.code} при оценке Trade-in.`,
      actionUrl: "/trade-in",
    },
  });

  return bonus;
}

export async function listOrderItemsForAccessoryHints(orderId: string) {
  return prisma.orderItem.findMany({
    where: { orderId },
    include: {
      product: true,
    },
  });
}
