import { prisma } from "@prostor/db";
import { getSession } from "./auth/session";
import { getUserReferralPromoCode } from "./promo";

export async function getCurrentUserProfile() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const [user, referralPromoCode] = await Promise.all([
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
                product: true,
              },
            },
            appliedPromoCode: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    }),
    getUserReferralPromoCode(session.user.id),
  ]);

  if (!user) {
    return null;
  }

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
    orders: user.orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: Number(order.total),
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
      })),
    })),
  };
}