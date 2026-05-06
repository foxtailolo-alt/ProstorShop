import { prisma } from "@prostor/db";
import {
  ACCESSORY_LABELS,
  detectAccessoryKindFromText,
  detectAccessoryTargetCategory,
} from "./device-accessories";

const ACCESSORY_NOTIFICATION_KIND = "accessory_pending";

export async function createAccessoryHintsForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: true,
              imageUrl: true,
              category: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!order || !order.userId) return { created: 0 };

  let created = 0;
  for (const item of order.items) {
    const product = item.product;
    if (!product) continue;

    const text = [
      product.name,
      product.brand,
      product.category?.slug,
      product.category?.name,
      item.variantLabel,
    ];
    const kind = detectAccessoryKindFromText(...text);
    if (!kind) continue;

    const targetCategory = detectAccessoryTargetCategory(...text);

    const existing = await prisma.profileNotification.findFirst({
      where: {
        userId: order.userId,
        kind: ACCESSORY_NOTIFICATION_KIND,
        productId: product.id,
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.profileNotification.create({
      data: {
        userId: order.userId,
        kind: ACCESSORY_NOTIFICATION_KIND,
        productId: product.id,
        title: `${ACCESSORY_LABELS[kind]} ждёт привязки к устройству`,
        body: `Вы купили «${product.name}». Привяжите аксессуар к устройству в профиле и соберите комплект для бонуса при Trade-in.`,
        actionUrl: `/profile?tab=devices&accessory=${kind}${targetCategory ? `&target=${targetCategory}` : ""}&orderItemId=${item.id}`,
      },
    });
    created += 1;
  }

  return { created };
}
