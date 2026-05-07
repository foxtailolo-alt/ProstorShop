"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@prostor/db";
import { getSession } from "../../../lib/auth/session";
import { getAttributionSnapshot } from "../../../lib/attribution";
import { parseProductOptions, resolveVariantSelection } from "../../../lib/cart-selection";
import { buildCartEntriesWithPricing } from "../../../lib/cart-pricing";
import { addCartItem, buildCartItemKey, clearCart, getCartItems, removeCartItem, updateCartItem } from "../../../lib/cart";
import { findCatalogProductBySlug } from "../../../lib/data/catalog";
import { generateUniqueOrderNumber, isOrderNumberConflict } from "../../../lib/order-number";
import { clearAppliedPromoCode, getAppliedPromoCode, getPromoCodeSummary, setAppliedPromoCode } from "../../../lib/promo";
import { resolveProductPrice } from "../../../lib/pricing";

export async function addToCartAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  const requestedVariant = String(formData.get("variant") ?? "").trim();
  const redirectToInput = String(formData.get("redirectTo") ?? "").trim();

  if (!productSlug || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Add to cart request is invalid.");
  }

  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    select: {
      price: true,
      options: true,
      discountType: true,
      discountValue: true,
      discountStartsAt: true,
      discountEndsAt: true,
    },
  });

  const fallbackProduct = !product ? await findCatalogProductBySlug(productSlug) : null;

  if (!product && !fallbackProduct) {
    throw new Error("Product was not found.");
  }

  const resolvedProduct = product ?? {
    price: fallbackProduct!.price,
    options: null,
    discountType: fallbackProduct!.discountType,
    discountValue: fallbackProduct!.discountValue,
    discountStartsAt: null,
    discountEndsAt: fallbackProduct!.discountEndsAt ?? null,
  };

  const rawSelection = resolveVariantSelection(
    Number(resolvedProduct.price),
    parseProductOptions(resolvedProduct.options),
    requestedVariant,
  );

  const resolvedSelection = {
    variantLabel: rawSelection.variantLabel,
    unitPrice: resolveProductPrice({
      basePrice: rawSelection.unitPrice,
      discountType: resolvedProduct.discountType,
      discountValue: resolvedProduct.discountValue ? Number(resolvedProduct.discountValue) : null,
      discountStartsAt: resolvedProduct.discountStartsAt,
      discountEndsAt: resolvedProduct.discountEndsAt,
    }).price,
  };

  await addCartItem({
    productSlug,
    quantity,
    variantLabel: resolvedSelection.variantLabel,
    unitPrice: resolvedSelection.unitPrice,
  });

  const nextCartItems = await getCartItems();
  const cartCount = nextCartItems.reduce((sum, item) => sum + item.quantity, 0);

  revalidatePath("/cart");
  revalidatePath("/");
  revalidatePath(`/catalog`);

  if (!redirectToInput) {
    return {
      cartCount,
      productSlug,
    };
  }

  const redirectTo = redirectToInput.startsWith("/") ? redirectToInput : "/cart";
  const separator = redirectTo.includes("?") ? "&" : "?";
  redirect(`${redirectTo}${separator}added=${productSlug}` as "/cart");
}

export async function updateCartItemAction(formData: FormData) {
  const itemKey = String(formData.get("itemKey") ?? formData.get("productSlug") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!itemKey || !Number.isInteger(quantity)) {
    throw new Error("Cart update is invalid.");
  }

  await updateCartItem(itemKey, quantity);
  revalidatePath("/cart");
  redirect("/cart");
}

export async function removeCartItemAction(formData: FormData) {
  const itemKey = String(formData.get("itemKey") ?? formData.get("productSlug") ?? "").trim();

  if (!itemKey) {
    throw new Error("Cart remove request is invalid.");
  }

  await removeCartItem(itemKey);
  revalidatePath("/cart");
  redirect("/cart");
}

export async function clearCartAction() {
  await clearCart();
  await clearAppliedPromoCode();
  revalidatePath("/cart");
  redirect("/cart");
}

export async function applyPromoCodeAction(formData: FormData) {
  const code = String(formData.get("promoCode") ?? "").trim();

  try {
    const session = await getSession();
    const promoCode = await getPromoCodeSummary(code, session?.user.id ?? null);
    await setAppliedPromoCode(promoCode.code);
    revalidatePath("/cart");
    redirect("/cart?promo=applied");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось применить промокод.";
    redirect(`/cart?promoError=${encodeURIComponent(message)}`);
  }
}

export async function clearPromoCodeAction() {
  await clearAppliedPromoCode();
  revalidatePath("/cart");
  redirect("/cart?promo=cleared");
}

export async function submitOrderAction(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const fallbackProductSlug = String(formData.get("productSlug") ?? "").trim();
  const fallbackQuantity = Number(formData.get("quantity") ?? 1);
  const fallbackVariant = String(formData.get("variant") ?? "").trim();

  if (!customerName || !phone) {
    throw new Error("Checkout form is incomplete.");
  }

  const [cartItems, session, attribution, appliedPromoCodeValue] = await Promise.all([
    getCartItems(),
    getSession(),
    getAttributionSnapshot(),
    getAppliedPromoCode(),
  ]);

  const appliedPromoCode = appliedPromoCodeValue
    ? await getPromoCodeSummary(appliedPromoCodeValue, session?.user.id ?? null)
    : null;

  const normalizedItems = cartItems.length > 0
    ? cartItems
    : fallbackProductSlug && Number.isInteger(fallbackQuantity) && fallbackQuantity > 0
      ? [{
          itemKey: buildCartItemKey(fallbackProductSlug, fallbackVariant),
          productSlug: fallbackProductSlug,
          quantity: fallbackQuantity,
          variantLabel: fallbackVariant || undefined,
          unitPrice: 0,
        }]
      : [];

  if (normalizedItems.length === 0) {
    throw new Error("Cart is empty.");
  }

  const products = await prisma.product.findMany({
    where: {
      slug: {
        in: normalizedItems.map((item) => item.productSlug),
      },
    },
    include: {
      category: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (products.length !== normalizedItems.length) {
    throw new Error("One or more cart items were not found.");
  }

  const resolvedOrderItems = normalizedItems.map((item) => {
    const product = products.find((entry) => entry.slug === item.productSlug);

    if (!product) {
      throw new Error("Product not found.");
    }

    const rawSelection = item.unitPrice > 0
      ? {
          variantLabel: item.variantLabel,
          unitPrice: item.unitPrice,
        }
      : resolveVariantSelection(Number(product.price), parseProductOptions(product.options), item.variantLabel ?? "");

    const resolvedSelection = {
      variantLabel: rawSelection.variantLabel,
      unitPrice: resolveProductPrice({
        basePrice: rawSelection.unitPrice,
        discountType: product.discountType,
        discountValue: product.discountValue ? Number(product.discountValue) : null,
        discountStartsAt: product.discountStartsAt,
        discountEndsAt: product.discountEndsAt,
      }).price,
    };

    return {
      productId: product.id,
      productSlug: product.slug,
      categorySlug: product.category.slug,
      quantity: item.quantity,
      variantLabel: resolvedSelection.variantLabel,
      baseUnitPrice: resolvedSelection.unitPrice,
    };
  });

  const pricedOrderItems = buildCartEntriesWithPricing({
    cartItems: resolvedOrderItems.map((item) => ({
      itemKey: buildCartItemKey(item.productSlug, item.variantLabel),
      productSlug: item.productSlug,
      quantity: item.quantity,
      variantLabel: item.variantLabel,
      unitPrice: item.baseUnitPrice,
    })),
    products: resolvedOrderItems.map((item) => ({
      slug: item.productSlug,
      categorySlug: item.categorySlug,
      productId: item.productId,
    })),
  });

  const orderItems = resolvedOrderItems.map((item) => {
    const pricedItem = pricedOrderItems.find((entry) => entry.item.itemKey === buildCartItemKey(item.productSlug, item.variantLabel));

    if (!pricedItem) {
      throw new Error("Cart pricing could not be resolved.");
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
      variantLabel: item.variantLabel,
      price: pricedItem.effectiveUnitPrice,
      subtotal: pricedItem.subtotal,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  let order: { id: string; orderNumber: string | null } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      order = await prisma.$transaction(async (transaction) => {
        if (session?.user.id) {
          await transaction.user.update({
            where: { id: session.user.id },
            data: { phone },
          });
        }

        const orderNumber = await generateUniqueOrderNumber(async (candidate) => {
          const existingOrder = await transaction.order.findUnique({
            where: { orderNumber: candidate },
            select: { id: true },
          });

          return Boolean(existingOrder);
        });

        const createdOrder = await transaction.order.create({
          data: {
            orderNumber,
            userId: session?.user.id ?? null,
            customerName,
            phone,
            note: note || null,
            total,
            attribution: attribution ?? undefined,
            appliedPromoCodeId: appliedPromoCode?.id ?? null,
            promoRewardDescription: appliedPromoCode?.rewardDescription ?? null,
            items: {
              create: orderItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                variantLabel: item.variantLabel,
              })),
            },
          },
          select: {
            id: true,
            orderNumber: true,
          },
        });

        if (appliedPromoCode) {
          await transaction.promoCode.update({
            where: { id: appliedPromoCode.id },
            data: {
              usageCount: {
                increment: 1,
              },
            },
          });
        }

        return createdOrder;
      });

      break;
    } catch (error) {
      if (attempt < 4 && isOrderNumberConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  if (!order) {
    throw new Error("Не удалось оформить заказ.");
  }

  await clearCart();
  await clearAppliedPromoCode();
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/profile");
  redirect(`/cart?success=1&orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber ?? order.id)}`);
}